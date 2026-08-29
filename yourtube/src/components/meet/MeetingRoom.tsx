import { useEffect, useRef, useState } from "react";
import { Download, LogIn, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { MeetingUser } from "@/lib/meet/types";
import { useMeetingRoom } from "@/lib/meet/useMeetingRoom";
import { useMedia } from "@/lib/meet/useMedia";
import { useRecording } from "@/lib/meet/useRecording";
import { uploadRecording } from "@/lib/meet/api";
import ParticipantTile from "./ParticipantTile";
import ControlBar from "./ControlBar";
import ParticipantsPanel from "./ParticipantsPanel";
import ChatPanel from "./ChatPanel";
import InviteDialog from "./InviteDialog";

type Props = {
  roomId: string;
  token: string;
  user: MeetingUser;
  passcode: string;
  startedAt?: string | null;
  onExit: (reason?: string) => void;
};

export default function MeetingRoom({
  roomId,
  token,
  user,
  passcode,
  startedAt,
  onExit,
}: Props) {
  const [phase, setPhase] = useState<"pre" | "call">("pre");
  const [preState, setPreState] = useState({ micOn: true, camOn: true });

  if (phase === "pre") {
    return (
      <PreJoin
        roomId={roomId}
        onStateChange={setPreState}
        onJoin={() => setPhase("call")}
      />
    );
  }

  return (
    <CallScreen
      roomId={roomId}
      token={token}
      user={user}
      passcode={passcode}
      startedAt={startedAt}
      initialMicOn={preState.micOn}
      initialCamOn={preState.camOn}
      onExit={onExit}
    />
  );
}

function PreJoin({
  roomId,
  onStateChange,
  onJoin,
}: {
  roomId: string;
  onStateChange: (s: { micOn: boolean; camOn: boolean }) => void;
  onJoin: () => void;
}) {
  const media = useMedia();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    onStateChange({ micOn: media.micOn, camOn: media.camOn });
  }, [media.micOn, media.camOn, onStateChange]);

  useEffect(() => {
    media.startMedia();
    return () => {
      media.localStream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (el && media.localStream) {
      el.srcObject = media.localStream;
      el.play().catch(() => {});
    }
  }, [media.localStream]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-slate-950 px-4 text-white">
      <div className="w-full max-w-3xl">
        <h1 className="mb-4 text-center text-2xl font-semibold">
          Ready to join? <span className="text-blue-400">{roomId}</span>
        </h1>
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-800">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
          {!media.localStream && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400">
              {media.requesting ? "Requesting camera…" : "Camera preview"}
            </div>
          )}
          {media.permissionError && (
            <div className="absolute inset-x-0 bottom-0 bg-red-600/90 px-4 py-2 text-center text-sm">
              {media.permissionError}
            </div>
          )}
        </div>
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={media.toggleMic}
            title={media.micOn ? "Mute" : "Unmute"}
          >
            {media.micOn ? (
              <Mic className="h-5 w-5" />
            ) : (
              <MicOff className="h-5 w-5" />
            )}
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={media.toggleCam}
            title={media.camOn ? "Turn camera off" : "Turn camera on"}
          >
            {media.camOn ? (
              <Video className="h-5 w-5" />
            ) : (
              <VideoOff className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
      <Button
        size="lg"
        className="gap-2 rounded-full bg-blue-600 px-8 hover:bg-blue-700"
        onClick={onJoin}
      >
        <LogIn className="h-5 w-5" />
        Join meeting
      </Button>
    </div>
  );
}

function CallScreen({
  roomId,
  token,
  user,
  passcode,
  startedAt,
  initialMicOn,
  initialCamOn,
  onExit,
}: Props & { initialMicOn: boolean; initialCamOn: boolean }) {
  const room = useMeetingRoom({
    roomId,
    token,
    user,
    reconnectKey: `rk-${roomId}-${user.id}-${Date.now()}`,
    startedAt,
    initialMicOn,
    initialCamOn,
    onExit: (reason) => onExit(reason),
  });

  const recorder = useRecording({
    localStream: room.media.localStream,
    participantStreams: room.participantStreams,
    participants: room.participants,
  });

  useEffect(() => {
    room.media.startMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [uploadingRecording, setUploadingRecording] = useState(false);

  const participants = room.participants;
  const presenter = participants.find((p) => p.presenting);

  const toggleRecording = () => {
    if (recorder.recording) {
      recorder.stopRecording();
    } else {
      recorder.startRecording();
    }
  };

  const saveRecording = () => {
    if (!recorder.recordingUrl) return;
    const a = document.createElement("a");
    a.href = recorder.recordingUrl;
    a.download = `meeting-${roomId}.webm`;
    a.click();
  };

  const uploadRecordingToHost = async () => {
    if (!recorder.recordingUrl) return;
    setUploadingRecording(true);
    try {
      const blob = await fetch(recorder.recordingUrl).then((r) => r.blob());
      const res = await uploadRecording(blob, roomId);
      toast.success("Recording uploaded. Host can download it.");
      window.open(res.url, "_blank");
    } catch {
      toast.error("Recording upload failed.");
    } finally {
      setUploadingRecording(false);
    }
  };

  if (room.connectionState === "connecting") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-slate-950 text-white">
        <span className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <p className="text-slate-300">Joining meeting…</p>
      </div>
    );
  }

  if (room.connectionState === "denied") {
    return (
      <Overlay title="Cannot join meeting" message={room.denyReason || "Access denied."}>
        <Button onClick={() => onExit("denied")}>Back to meetings</Button>
      </Overlay>
    );
  }

  if (room.connectionState === "ended") {
    return (
      <Overlay title="Meeting ended" message="The host ended the meeting.">
        <Button onClick={() => onExit("ended")}>Back to meetings</Button>
      </Overlay>
    );
  }

  if (room.connectionState === "removed") {
    return (
      <Overlay title="You were removed" message="The host removed you from this meeting.">
        <Button onClick={() => onExit("removed")}>Back to meetings</Button>
      </Overlay>
    );
  }

  const canShareScreen = room.permissions.canShareScreen || room.isHost || room.isCohost;

  return (
    <div className="relative flex h-full bg-slate-950 text-white">
      {room.connectionState === "reconnecting" && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-slate-950/80 backdrop-blur-sm">
          <span className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-slate-200">Connection lost. Reconnecting…</p>
        </div>
      )}

      {room.meMutedByHost && (
        <div className="absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-full bg-red-600 px-4 py-1.5 text-sm font-medium">
          You were muted by the host
        </div>
      )}

      {room.media.permissionError && (
        <div className="absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full bg-slate-800 px-4 py-1.5 text-sm">
          <span>{room.media.permissionError}</span>
          <button
            className="font-semibold text-blue-400 hover:underline"
            onClick={room.media.startMedia}
          >
            Retry
          </button>
        </div>
      )}

      {recorder.recordingUrl && (
        <div className="absolute right-4 top-4 z-30 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-white/10 bg-slate-900 p-3 shadow-xl">
          <p className="mb-2 text-sm font-semibold">Recording ready</p>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video src={recorder.recordingUrl} controls className="mb-2 max-h-36 w-full rounded" />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={saveRecording}>
              <Download className="mr-1 h-4 w-4" /> Save
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="flex-1"
              disabled={uploadingRecording}
              onClick={uploadRecordingToHost}
            >
              {uploadingRecording ? "Uploading…" : "Upload for host"}
            </Button>
          </div>
        </div>
      )}

      <main className="flex flex-1 flex-col items-center overflow-hidden">
        <div
          className={cn(
            "grid w-full flex-1 gap-3 overflow-y-auto p-4",
            participants.length <= 1
              ? "grid-cols-1 content-center"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-min"
          )}
        >
          {participants.map((p) => {
            const stream =
              p.socketId === room.self?.socketId
                ? room.media.localStream
                : room.participantStreams[p.socketId];
            return (
              <div
                key={p.socketId}
                className={cn(
                  presenter?.socketId === p.socketId &&
                    participants.length > 1 &&
                    "sm:col-span-2 sm:row-span-2"
                )}
              >
                <ParticipantTile
                  participant={p}
                  stream={stream}
                  isSelf={p.socketId === room.self?.socketId}
                />
              </div>
            );
          })}
        </div>

        <div className="pb-4">
          <ControlBar
            micOn={room.media.micOn}
            camOn={room.media.camOn}
            canSwitchCamera={room.media.canSwitchCamera}
            presenting={room.media.presenting}
            canShareScreen={canShareScreen}
            chatOpen={room.chatOpen}
            participantsOpen={room.participantsOpen}
            handRaised={room.handRaised}
            recording={recorder.recording}
            canRecord={room.isHost || room.isCohost}
            locked={room.locked}
            isHost={room.isHost}
            callDuration={room.callDuration}
            onToggleMic={room.media.toggleMic}
            onToggleCam={room.media.toggleCam}
            onSwitchCamera={room.media.switchCamera}
            onToggleScreenShare={() => {
              if (room.media.presenting) {
                room.media.stopScreenShare();
              } else if (canShareScreen) {
                room.media.startScreenShare();
              } else {
                toast.error("Screen sharing is disabled by the host.");
              }
            }}
            onToggleChat={() => room.setChatOpen(!room.chatOpen)}
            onToggleParticipants={() =>
              room.setParticipantsOpen(!room.participantsOpen)
            }
            onToggleInvite={() => room.setInviteOpen(true)}
            onToggleHand={room.toggleRaiseHand}
            onToggleRecording={toggleRecording}
            onToggleLock={() => room.hostSetLocked(!room.locked)}
            onLeave={room.leave}
          />
        </div>
      </main>

      {room.participantsOpen && (
        <ParticipantsPanel
          participants={participants}
          self={room.self}
          isHost={room.isHost}
          isCohost={room.isCohost}
          hostSetMic={room.hostSetMic}
          hostRemove={room.hostRemove}
          hostToggleCohost={room.hostToggleCohost}
          onClose={() => room.setParticipantsOpen(false)}
        />
      )}

      {room.chatOpen && (
        <ChatPanel
          messages={room.chatMessages}
          canChat={room.permissions.canChat || room.isHost || room.isCohost}
          onSendMessage={room.sendChatMessage}
          onSendFile={room.sendChatFile}
          onClose={() => room.setChatOpen(false)}
        />
      )}

      <InviteDialog
        open={room.inviteOpen}
        onOpenChange={room.setInviteOpen}
        roomId={roomId}
        passcode={passcode}
      />
    </div>
  );
}

function Overlay({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-950 px-4 text-center text-white">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="max-w-md text-slate-400">{message}</p>
      {children}
    </div>
  );
}
