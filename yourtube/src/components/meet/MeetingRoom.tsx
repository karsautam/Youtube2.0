import { useEffect, useRef, useState } from "react";
import { LogIn, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMedia } from "@/lib/meet/useMedia";
import type { MeetingUser } from "@/lib/meet/types";
import CallScreen from "./CallScreen";

type Props = {
  roomId: string;
  token: string;
  user: MeetingUser;
  passcode: string;
  startedAt?: string | null;
  onExit: (reason?: string) => void;
  onHome?: () => void;
};

export default function MeetingRoom({
  roomId,
  token,
  user,
  passcode,
  startedAt,
  onExit,
  onHome,
}: Props) {
  const [phase, setPhase] = useState<"pre" | "call">("pre");
  const [preState, setPreState] = useState({ micOn: true, camOn: true });

  if (phase === "pre") {
    return <PreJoin roomId={roomId} onStateChange={setPreState} onJoin={() => setPhase("call")} />;
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
      onHome={onHome}
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
