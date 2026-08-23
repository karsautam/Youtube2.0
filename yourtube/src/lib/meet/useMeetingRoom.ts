import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket, disconnectSocket } from "./socketClient";
import { RTC_CONFIG } from "./types";
import type {
  ChatMessage,
  MeetingPermissions,
  MeetingUser,
  Participant,
} from "./types";
import { useMedia, type MediaManager } from "./useMedia";
import { uploadChatFile } from "./api";

export type ConnectionState =
  | "connecting"
  | "joined"
  | "reconnecting"
  | "ended"
  | "removed"
  | "denied";

type Peer = {
  pc: RTCPeerConnection;
  stream: MediaStream;
  pendingCandidates: RTCIceCandidateInit[];
  created: number;
  lostPrev?: number;
  totalPrev?: number;
};

type Args = {
  roomId: string;
  token: string;
  user: MeetingUser;
  reconnectKey: string;
  startedAt?: string | null;
  onExit: (reason?: string) => void;
};

export type MeetingRoomApi = {
  connectionState: ConnectionState;
  denyReason: string | null;
  self: Participant | null;
  participants: Participant[];
  participantStreams: Record<string, MediaStream>;
  hostId: string | null;
  coHostIds: Set<string>;
  isHost: boolean;
  isCohost: boolean;
  locked: boolean;
  permissions: MeetingPermissions;
  chatMessages: ChatMessage[];
  chatOpen: boolean;
  setChatOpen: (v: boolean) => void;
  participantsOpen: boolean;
  setParticipantsOpen: (v: boolean) => void;
  inviteOpen: boolean;
  setInviteOpen: (v: boolean) => void;
  handRaised: boolean;
  toggleRaiseHand: () => void;
  meMutedByHost: boolean;
  callDuration: number;
  connectionQuality: "excellent" | "good" | "poor";
  media: MediaManager;
  sendChatMessage: (text: string) => void;
  sendChatFile: (file: File) => Promise<void>;
  leave: () => void;
  hostSetMic: (targetId: string, on: boolean) => void;
  hostRemove: (targetId: string) => void;
  hostToggleCohost: (userId: string, isCohost: boolean) => void;
  hostSetLocked: (v: boolean) => void;
  hostSetPermissions: (p: Partial<MeetingPermissions>) => void;
  hostEndMeeting: () => void;
};

export function useMeetingRoom({
  roomId,
  token,
  user,
  reconnectKey,
  startedAt,
  onExit,
}: Args): MeetingRoomApi {
  const media = useMedia((speaking) => onSpeakingRef.current(speaking));
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [denyReason, setDenyReason] = useState<string | null>(null);
  const [self, setSelf] = useState<Participant | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantStreams, setParticipantStreams] = useState<
    Record<string, MediaStream>
  >({});
  const [hostId, setHostId] = useState<string | null>(null);
  const [coHostIds, setCoHostIds] = useState<Set<string>>(new Set());
  const [locked, setLocked] = useState(false);
  const [permissions, setPermissions] = useState<MeetingPermissions>({
    canShareScreen: true,
    canChat: true,
  });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [meMutedByHost, setMeMutedByHost] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState<
    "excellent" | "good" | "poor"
  >("good");

  const peersRef = useRef<Map<string, Peer>>(new Map());
  const participantsMapRef = useRef<Map<string, Participant>>(new Map());
  const mediaRef = useRef(media);
  mediaRef.current = media;
  const onSpeakingRef = useRef<(speaking: boolean) => void>(() => {});
  const selfRef = useRef<Participant | null>(null);
  const hostIdRef = useRef<string | null>(null);
  const coHostIdsRef = useRef<Set<string>>(new Set());
  const joinedRef = useRef(false);
  const exitedRef = useRef(false);
  const qualityTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(
    startedAt ? new Date(startedAt).getTime() : Date.now()
  );

  const emit = useCallback((event: string, payload?: any) => {
    getSocket().emit(event, payload);
  }, []);

  // ---------- participant store helpers ----------
  const setParticipantsAll = useCallback((list: Participant[]) => {
    participantsMapRef.current = new Map(list.map((p) => [p.socketId, p]));
    setParticipants(list);
  }, []);

  const upsertParticipant = useCallback((p: Participant) => {
    participantsMapRef.current.set(p.socketId, p);
    setParticipants([...participantsMapRef.current.values()]);
  }, []);

  const updateParticipantState = useCallback(
    (socketId: string, patch: Partial<Participant>) => {
      const p = participantsMapRef.current.get(socketId);
      if (!p) return;
      Object.assign(p, patch);
      setParticipants([...participantsMapRef.current.values()]);
    },
    []
  );

  // ---------- peer management ----------
  const closePeer = useCallback((socketId: string) => {
    const peer = peersRef.current.get(socketId);
    if (peer) {
      peer.pc.onicecandidate = null;
      peer.pc.ontrack = null;
      peer.pc.onconnectionstatechange = null;
      try {
        peer.pc.close();
      } catch {}
      peersRef.current.delete(socketId);
    }
    setParticipantStreams((prev) => {
      if (!(socketId in prev)) return prev;
      const next = { ...prev };
      delete next[socketId];
      return next;
    });
  }, []);

  const closeAllPeers = useCallback(() => {
    for (const socketId of [...peersRef.current.keys()]) closePeer(socketId);
  }, [closePeer]);

  const sendOffer = useCallback(
    async (socketId: string) => {
      const peer = peersRef.current.get(socketId);
      if (!peer) return;
      if (peer.pc.signalingState !== "stable") return;
      try {
        const offer = await peer.pc.createOffer();
        await peer.pc.setLocalDescription(offer);
        emit("rtc:offer", { to: socketId, sdp: offer });
      } catch (err) {
        console.warn("createOffer failed", err);
      }
    },
    [emit]
  );

  const createPeer = useCallback(
    (socketId: string) => {
      closePeer(socketId);
      const pc = new RTCPeerConnection(RTC_CONFIG);
      const peer: Peer = {
        pc,
        stream: new MediaStream(),
        pendingCandidates: [],
        created: Date.now(),
      };
      peersRef.current.set(socketId, peer);

      const stream = mediaRef.current.localStream;
      const activeVideo = mediaRef.current.getActiveVideoTrack();
      if (stream) {
        stream.getTracks().forEach((t) => {
          if (!pc.getSenders().some((s) => s.track === t)) pc.addTrack(t, stream);
        });
      }
      if (activeVideo) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender && sender.track !== activeVideo) {
          sender.replaceTrack(activeVideo).catch(() => {});
        }
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          emit("rtc:ice", {
            to: socketId,
            candidate: e.candidate.toJSON?.() ?? e.candidate,
          });
        }
      };
      pc.ontrack = (e) => {
        if (e.streams?.[0]) {
          e.streams[0].getTracks().forEach((t) => {
            if (!peer.stream.getTracks().some((x) => x.id === t.id)) {
              peer.stream.addTrack(t);
            }
          });
        } else if (!peer.stream.getTracks().some((x) => x.id === e.track.id)) {
          peer.stream.addTrack(e.track);
        }
        setParticipantStreams((prev) => ({
          ...prev,
          [socketId]: peer.stream,
        }));
      };
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "failed") {
          const p = participantsMapRef.current.get(socketId);
          if (joinedRef.current && p && !p.reconnecting) {
            setTimeout(() => {
              if (
                peersRef.current.get(socketId)?.pc === pc &&
                joinedRef.current
              ) {
                void sendOffer(socketId);
              }
            }, 4000);
          }
        }
      };
      return peer;
    },
    [closePeer, emit, sendOffer]
  );

  const handleOffer = useCallback(
    async (from: string, sdp: RTCSessionDescriptionInit) => {
      const peer = createPeer(from);
      try {
        await peer.pc.setRemoteDescription(sdp);
      } catch (err) {
        if (peer.pc.signalingState === "have-local-offer") {
          try {
            await peer.pc.setLocalDescription({ type: "rollback" });
            await peer.pc.setRemoteDescription(sdp);
          } catch (e2) {
            console.warn("setRemoteDescription failed", e2);
          }
        } else {
          console.warn("setRemoteDescription failed", err);
        }
      }
      peer.pendingCandidates.forEach((c) => {
        peer.pc.addIceCandidate(c).catch(() => {});
      });
      peer.pendingCandidates = [];
      try {
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        emit("rtc:answer", { to: from, sdp: answer });
      } catch (err) {
        console.warn("createAnswer failed", err);
      }
    },
    [createPeer, emit]
  );

  const handleAnswer = useCallback(
    async (from: string, sdp: RTCSessionDescriptionInit) => {
      const peer = peersRef.current.get(from);
      if (!peer) return;
      try {
        await peer.pc.setRemoteDescription(sdp);
      } catch (err) {
        console.warn("setRemoteDescription(answer) failed", err);
      }
    },
    []
  );

  const handleIce = useCallback((from: string, candidate: RTCIceCandidateInit) => {
    const peer = peersRef.current.get(from);
    if (!peer) return;
    if (peer.pc.remoteDescription) {
      peer.pc.addIceCandidate(candidate).catch(() => {});
    } else {
      peer.pendingCandidates.push(candidate);
    }
  }, []);

  const replaceVideoTracksAll = useCallback(async (track: MediaStreamTrack | null) => {
    const ids = [...peersRef.current.keys()];
    await Promise.all(
      ids.map(async (socketId) => {
        const peer = peersRef.current.get(socketId);
        if (!peer) return;
        const sender = peer.pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          try {
            await sender.replaceTrack(track);
          } catch {}
        }
      })
    );
  }, []);

  // ---------- quality monitor ----------
  const scorePeers = useCallback(async (): Promise<"excellent" | "good" | "poor"> => {
    if (peersRef.current.size === 0) return "good";
    let poor = false;
    let good = false;
    for (const peer of peersRef.current.values()) {
      try {
        const stats = await peer.pc.getStats();
        let rtt = 0;
        let hasPair = false;
        let lost = 0;
        let total = 0;
        stats.forEach((s: any) => {
          if (s.type === "candidate-pair" && s.state === "succeeded") {
            rtt = Math.max(rtt, s.currentRoundTripTime || 0);
            hasPair = true;
          }
          if (s.type === "inbound-rtp" && s.kind === "video") {
            const pl = s.packetsLost || 0;
            const pt = s.packetsReceived || 0;
            const dLost = pl - (peer.lostPrev || 0);
            const dTotal = pt - (peer.totalPrev || 0);
            peer.lostPrev = pl;
            peer.totalPrev = pt;
            if (dTotal > 0) {
              lost += Math.max(0, dLost);
              total += dTotal;
            }
          }
        });
        const ratio = total > 0 ? lost / total : 0;
        if (rtt > 350 || ratio > 0.1) poor = true;
        else if (rtt > 150 || ratio > 0.04) good = true;
        else if (!hasPair && total === 0) good = true;
      } catch {}
    }
    if (poor) return "poor";
    if (good) return "good";
    return "excellent";
  }, []);

  const startQualityMonitor = useCallback(() => {
    if (qualityTimerRef.current) clearInterval(qualityTimerRef.current);
    qualityTimerRef.current = setInterval(async () => {
      const q = await scorePeers();
      setConnectionQuality(q);
      if (joinedRef.current) emit("quality", { quality: q });
      const target =
        q === "poor" ? 200_000 : q === "good" ? 700_000 : 2_000_000;
      for (const peer of peersRef.current.values()) {
        const sender = peer.pc.getSenders().find((s) => s.track?.kind === "video");
        if (!sender) continue;
        try {
          const params = sender.getParameters();
          if (!params.encodings || params.encodings.length === 0) continue;
          params.encodings.forEach((e: any) => {
            e.maxBitrate = target;
          });
          await sender.setParameters(params);
        } catch {}
      }
    }, 5000);
  }, [emit, scorePeers]);

  // ---------- bootstrap (joined / reconnected) ----------
  const bootstrap = useCallback(
    (data: any) => {
      joinedRef.current = true;
      setConnectionState("joined");
      setLocked(data.locked);
      setPermissions(data.permissions || { canShareScreen: true, canChat: true });
      hostIdRef.current = data.hostId;
      coHostIdsRef.current = new Set(data.coHostIds || []);
      setHostId(data.hostId);
      setCoHostIds(new Set(data.coHostIds || []));
      setChatMessages(data.chat || []);

      const selfData: Participant = data.self;
      const others: Participant[] = data.participants || [];
      selfRef.current = selfData;
      setSelf(selfData);
      setParticipantsAll([selfData, ...others]);

      closeAllPeers();
      others
        .filter((p) => !p.reconnecting)
        .forEach((p) => {
          createPeer(p.socketId);
          void sendOffer(p.socketId);
        });
      startQualityMonitor();
    },
    [
      closeAllPeers,
      createPeer,
      sendOffer,
      setParticipantsAll,
      startQualityMonitor,
    ]
  );

  // ---------- incoming event handlers ----------
  const handleDenied = useCallback((d: { reason: string }) => {
    setDenyReason(d.reason);
    setConnectionState("denied");
  }, []);

  const handleParticipantJoined = useCallback(
    (p: Participant) => {
      upsertParticipant(p);
      if (!p.reconnecting) createPeer(p.socketId);
    },
    [createPeer, upsertParticipant]
  );

  const handleParticipantLeft = useCallback(
    ({ socketId }: { socketId: string }) => {
      closePeer(socketId);
      participantsMapRef.current.delete(socketId);
      setParticipants([...participantsMapRef.current.values()]);
    },
    [closePeer]
  );

  const handleParticipantStatus = useCallback(
    ({ socketId, id, reconnecting }: any) => {
      let found: Participant | undefined;
      for (const p of participantsMapRef.current.values()) {
        if (p.id === id) {
          found = p;
          break;
        }
      }
      if (!found) return;
      if (reconnecting) {
        updateParticipantState(found.socketId, { reconnecting: true });
      } else {
        if (found.socketId !== socketId) {
          closePeer(found.socketId);
          participantsMapRef.current.delete(found.socketId);
          participantsMapRef.current.set(socketId, {
            ...found,
            socketId,
            reconnecting: false,
          });
          setParticipants([...participantsMapRef.current.values()]);
        } else {
          updateParticipantState(socketId, { reconnecting: false });
        }
      }
    },
    [closePeer, updateParticipantState]
  );

  const handleMediaState = useCallback(
    ({ socketId, micOn, camOn }: any) =>
      updateParticipantState(socketId, { micOn, camOn }),
    [updateParticipantState]
  );
  const handleSpeaking = useCallback(
    ({ socketId, speaking }: any) =>
      updateParticipantState(socketId, { speaking }),
    [updateParticipantState]
  );
  const handleHand = useCallback(
    ({ socketId, raised }: any) =>
      updateParticipantState(socketId, { raisedHand: raised }),
    [updateParticipantState]
  );
  const handleQuality = useCallback(
    ({ socketId, quality }: any) =>
      updateParticipantState(socketId, { quality }),
    [updateParticipantState]
  );
  const handleScreenState = useCallback(
    ({ socketId, presenting }: any) =>
      updateParticipantState(socketId, { presenting }),
    [updateParticipantState]
  );

  const handleChatMessage = useCallback((m: ChatMessage) => {
    setChatMessages((prev) => [...prev, m].slice(-200));
  }, []);

  const handleForceMic = useCallback(({ on }: { on: boolean }) => {
    mediaRef.current.setMic(on);
    if (!on) {
      setMeMutedByHost(true);
      setTimeout(() => setMeMutedByHost(false), 4000);
    }
  }, []);

  const handleRoleChanged = useCallback(
    ({ socketId, id, isCohost, hostId: h }: any) => {
      hostIdRef.current = h;
      setHostId(h);
      const set = new Set(coHostIdsRef.current);
      if (isCohost) set.add(id);
      else set.delete(id);
      coHostIdsRef.current = set;
      setCoHostIds(set);
      if (selfRef.current) {
        if (selfRef.current.id === id) {
          selfRef.current.isCohost = isCohost;
          setSelf({ ...selfRef.current });
        }
        if (selfRef.current.id === h) selfRef.current.isHost = true;
      }
      updateParticipantState(socketId, { isCohost });
    },
    [updateParticipantState]
  );

  const handleHostChanged = useCallback(({ hostId: h, newHostSocketId }: any) => {
    hostIdRef.current = h;
    setHostId(h);
    for (const p of participantsMapRef.current.values()) {
      if (p.id === h) {
        p.isHost = true;
        p.isCohost = false;
      } else if (p.isHost) {
        p.isHost = false;
      }
    }
    if (newHostSocketId) {
      const target = participantsMapRef.current.get(newHostSocketId);
      if (target) target.isHost = true;
    }
    if (selfRef.current) {
      const selfIsHost = selfRef.current.id === h;
      selfRef.current.isHost = selfIsHost;
      if (!selfIsHost) selfRef.current.isCohost = false;
      setSelf({ ...selfRef.current });
    }
    setParticipants([...participantsMapRef.current.values()]);
  }, []);

  const handleLocked = useCallback(({ locked: l }: { locked: boolean }) => {
    setLocked(l);
  }, []);
  const handlePermissions = useCallback((p: MeetingPermissions) => {
    setPermissions(p);
  }, []);
  const handleRemoved = useCallback(() => {
    exitedRef.current = true;
    setConnectionState("removed");
    disconnectSocket();
  }, []);
  const handleEnded = useCallback(() => {
    exitedRef.current = true;
    setConnectionState("ended");
    disconnectSocket();
  }, []);

  // ---------- outbound actions ----------
  const onSpeakingChange = useCallback(
    (speaking: boolean) => {
      if (joinedRef.current) emit("speaking", { speaking });
    },
    [emit]
  );
  onSpeakingRef.current = onSpeakingChange;

  useEffect(() => {
    if (joinedRef.current)
      emit("media:state", { micOn: media.micOn, camOn: media.camOn });
  }, [media.micOn, media.camOn, emit]);

  useEffect(() => {
    if (!joinedRef.current) return;
    void replaceVideoTracksAll(media.getActiveVideoTrack());
    emit("screen:state", { on: media.presenting });
  }, [media.presenting, emit, replaceVideoTracksAll]);

  // add tracks to existing peers once local media is ready
  useEffect(() => {
    if (!media.localStream || !joinedRef.current) return;
    const ids: string[] = [];
    for (const [socketId, peer] of peersRef.current) {
      let changed = false;
      media.localStream.getTracks().forEach((t) => {
        if (!peer.pc.getSenders().some((s) => s.track === t)) {
          peer.pc.addTrack(t, media.localStream!);
          changed = true;
        }
      });
      if (changed) ids.push(socketId);
    }
    if (media.presenting) {
      void replaceVideoTracksAll(media.getActiveVideoTrack());
    }
    ids.forEach((id) => void sendOffer(id));
  }, [media.localStream, media.presenting, replaceVideoTracksAll, sendOffer]);

  const toggleRaiseHand = useCallback(() => {
    const next = !handRaised;
    setHandRaised(next);
    emit("hand:raise", { raised: next });
  }, [handRaised, emit]);

  const sendChatMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      emit("chat:message", {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text: trimmed,
        ts: Date.now(),
      });
    },
    [emit]
  );

  const sendChatFile = useCallback(
    async (file: File) => {
      try {
        const res = await uploadChatFile(file);
        emit("chat:file", {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          url: res.url,
          name: res.name,
          size: res.size,
          fileType: res.type,
          ts: Date.now(),
        });
      } catch (err) {
        console.error("chat file upload failed", err);
        throw err;
      }
    },
    [emit]
  );

  // ---------- host moderation ----------
  const hostSetMic = useCallback(
    (targetId: string, on: boolean) => emit("mod:set-mic", { targetId, on }),
    [emit]
  );
  const hostRemove = useCallback(
    (targetId: string) => emit("mod:remove", { targetId }),
    [emit]
  );
  const hostToggleCohost = useCallback(
    (userId: string, isCohost: boolean) =>
      emit("mod:cohost", { targetId: userId, isCohost }),
    [emit]
  );
  const hostSetLocked = useCallback(
    (v: boolean) => {
      setLocked(v);
      emit("mod:lock", { locked: v });
    },
    [emit]
  );
  const hostSetPermissions = useCallback(
    (p: Partial<MeetingPermissions>) => {
      emit("mod:permissions", {
        canShareScreen: p.canShareScreen,
        canChat: p.canChat,
      });
    },
    [emit]
  );
  const hostEndMeeting = useCallback(() => emit("mod:end", {}), [emit]);

  // ---------- leave ----------
  const leave = useCallback(() => {
    if (exitedRef.current) return;
    exitedRef.current = true;
    emit("meet:leave", {});
    setTimeout(() => {
      closeAllPeers();
      media.stopScreenShare();
      media.localStream?.getTracks().forEach((t) => t.stop());
      disconnectSocket();
      onExit();
    }, 150);
  }, [closeAllPeers, emit, media, onExit]);

  // ---------- socket wiring ----------
  const handlersRef = useRef<any>({});
  handlersRef.current = {
    bootstrap,
    handleDenied,
    handleParticipantJoined,
    handleParticipantLeft,
    handleParticipantStatus,
    handleOffer,
    handleAnswer,
    handleIce,
    handleMediaState,
    handleSpeaking,
    handleHand,
    handleQuality,
    handleScreenState,
    handleChatMessage,
    handleForceMic,
    handleRoleChanged,
    handleHostChanged,
    handleLocked,
    handlePermissions,
    handleRemoved,
    handleEnded,
  };

  useEffect(() => {
    const socket = getSocket();
    const h = () => handlersRef.current;
    const disconnectHandler = () => {
      if (joinedRef.current && !exitedRef.current) {
        setConnectionState("reconnecting");
      }
    };

    socket.on("connect", () => {
      socket.emit("meet:join", { roomId, token, user, reconnectKey });
    });
    socket.on("meet:joined", (data: any) => h().bootstrap(data));
    socket.on("meet:reconnected", (data: any) => h().bootstrap(data));
    socket.on("meet:join-denied", (d: any) => h().handleDenied(d));
    socket.on("meet:participant-joined", (p: any) => h().handleParticipantJoined(p));
    socket.on("meet:participant-left", (d: any) => h().handleParticipantLeft(d));
    socket.on("meet:participant-status", (d: any) => h().handleParticipantStatus(d));
    socket.on("rtc:offer", (d: any) => h().handleOffer(d.from, d.sdp));
    socket.on("rtc:answer", (d: any) => h().handleAnswer(d.from, d.sdp));
    socket.on("rtc:ice", (d: any) => h().handleIce(d.from, d.candidate));
    socket.on("media:state", (d: any) => h().handleMediaState(d));
    socket.on("speaking", (d: any) => h().handleSpeaking(d));
    socket.on("hand:raise", (d: any) => h().handleHand(d));
    socket.on("quality", (d: any) => h().handleQuality(d));
    socket.on("screen:state", (d: any) => h().handleScreenState(d));
    socket.on("chat:message", (m: any) => h().handleChatMessage(m));
    socket.on("chat:file", (m: any) => h().handleChatMessage(m));
    socket.on("media:force-mic", (d: any) => h().handleForceMic(d));
    socket.on("meet:removed", () => h().handleRemoved());
    socket.on("meet:ended", () => h().handleEnded());
    socket.on("meet:locked", (d: any) => h().handleLocked(d));
    socket.on("role:changed", (d: any) => h().handleRoleChanged(d));
    socket.on("host:changed", (d: any) => h().handleHostChanged(d));
    socket.on("meet:permissions", (d: any) => h().handlePermissions(d));
    socket.on("disconnect", disconnectHandler);
    socket.on("connect_error", disconnectHandler);

    socket.connect();

    return () => {
      [
        "connect",
        "meet:joined",
        "meet:reconnected",
        "meet:join-denied",
        "meet:participant-joined",
        "meet:participant-left",
        "meet:participant-status",
        "rtc:offer",
        "rtc:answer",
        "rtc:ice",
        "media:state",
        "speaking",
        "hand:raise",
        "quality",
        "screen:state",
        "chat:message",
        "chat:file",
        "media:force-mic",
        "meet:removed",
        "meet:ended",
        "meet:locked",
        "role:changed",
        "host:changed",
        "meet:permissions",
        "disconnect",
        "connect_error",
      ].forEach((ev) => socket.off(ev as any));
    };
  }, [roomId, token, user, reconnectKey]);

  // duration timer
  useEffect(() => {
    const id = setInterval(() => {
      setCallDuration(Date.now() - startedAtRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // unmount cleanup
  useEffect(() => {
    return () => {
      if (qualityTimerRef.current) clearInterval(qualityTimerRef.current);
      closeAllPeers();
      disconnectSocket();
    };
  }, [closeAllPeers]);

  const isHost = Boolean(self?.isHost);
  const isCohost = Boolean(self?.isCohost);

  return {
    connectionState,
    denyReason,
    self,
    participants,
    participantStreams,
    hostId,
    coHostIds,
    isHost,
    isCohost,
    locked,
    permissions,
    chatMessages,
    chatOpen,
    setChatOpen,
    participantsOpen,
    setParticipantsOpen,
    inviteOpen,
    setInviteOpen,
    handRaised,
    toggleRaiseHand,
    meMutedByHost,
    callDuration,
    connectionQuality,
    media,
    sendChatMessage,
    sendChatFile,
    leave,
    hostSetMic,
    hostRemove,
    hostToggleCohost,
    hostSetLocked,
    hostSetPermissions,
    hostEndMeeting,
  };
}
