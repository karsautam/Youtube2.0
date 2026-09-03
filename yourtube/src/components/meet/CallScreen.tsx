import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Download, Home, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { MeetingUser } from "@/lib/meet/types";
import { useMeetingRoom } from "@/lib/meet/useMeetingRoom";
import { useMedia } from "@/lib/meet/useMedia";
import { useRecording } from "@/lib/meet/useRecording";
import { uploadRecording } from "@/lib/meet/api";
import { useMeetingContext } from "@/lib/meet/MeetingContext";
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
  initialMicOn: boolean;
  initialCamOn: boolean;
  onExit: (reason?: string) => void;
  onHome?: () => void;
};

export default function CallScreen({
  roomId,
  token,
  user,
  passcode,
  startedAt,
  initialMicOn,
  initialCamOn,
  onExit,
  onHome,
}: Props) {
  const { setLiveMedia, registerLeaveHandler } = useMeetingContext();
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

  useEffect(() => {
    registerLeaveHandler(room.leave);
    return () => registerLeaveHandler(null);
  }, [registerLeaveHandler, room.leave]);

  const recorder = useRecording({
    localStream: room.media.localStream,
    participantStreams: room.participantStreams,
    participants: room.participants,
  });

  useEffect(() => {
    room.media.startMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLiveMedia({
      micOn: room.media.micOn,
      camOn: room.media.camOn,
      localStream: room.media.localStream,
      selfSocketId: room.self?.socketId ?? null,
      participants: room.participants,
      participantStreams: room.participantStreams,
    });
  }, [
    room.media.micOn,
    room.media.camOn,
    room.media.localStream,
    room.self?.socketId,
    room.participants,
    room.participantStreams,
    setLiveMedia,
  ]);

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
  const router = useRouter();
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

      <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 rounded-xl bg-black/40 px-3 py-1.5 backdrop-blur">
          <Avatar className="h-8 w-8 border border-white/20">
            <AvatarImage src={user.image} alt={user.name} />
            <AvatarFallback className="bg-slate-700 text-xs">
              {user.name?.charAt(0)?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-white">{user.name}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 rounded-xl bg-black/40 px-3 py-1.5 text-white backdrop-blur hover:bg-black/60 hover:text-white"
          onClick={() => (onHome ? onHome() : router.push("/"))}
        >
          <Home className="h-4 w-4" />
          <span className="text-sm">Home</span>
        </Button>
      </div>

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
