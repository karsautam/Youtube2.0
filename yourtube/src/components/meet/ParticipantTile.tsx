import { useEffect, useRef } from "react";
import {
  Hand,
  Mic,
  MicOff,
  MonitorUp,
  Video,
  VideoOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Participant } from "@/lib/meet/types";

type Props = {
  participant: Participant;
  stream: MediaStream | null;
  isSelf?: boolean;
};

const QUALITY_DOT: Record<string, string> = {
  excellent: "bg-emerald-500",
  good: "bg-yellow-400",
  poor: "bg-red-500",
};

export default function ParticipantTile({ participant, stream, isSelf }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (el && stream) {
      if (el.srcObject !== stream) el.srcObject = stream;
      el.play().catch(() => {});
    }
  }, [stream]);

  const hasVideo = stream?.getVideoTracks().some((t) => t.readyState === "live");
  const camHidden = !hasVideo || !participant.camOn || participant.reconnecting;

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-xl bg-slate-800 border-2",
        participant.speaking && !isSelf
          ? "border-emerald-500"
          : "border-transparent"
      )}
    >
      {stream && hasVideo && participant.camOn && !participant.reconnecting ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-slate-800">
          <Avatar className="h-16 w-16">
            <AvatarImage src={participant.image} />
            <AvatarFallback>{participant.name?.[0] || "?"}</AvatarFallback>
          </Avatar>
        </div>
      )}

      {participant.presenting && (
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
          <MonitorUp className="h-3 w-3" />
          Presenting
        </div>
      )}

      {participant.reconnecting && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/70 text-white">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
          <span className="text-sm">Reconnectingâ€¦</span>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-2.5 py-2 text-white">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {participant.raisedHand && (
            <Hand className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          )}
          <span className="max-w-[12rem] truncate">
            {participant.name}
            {(participant.isHost || participant.isCohost) && (
              <span className="ml-1.5 rounded bg-amber-500 px-1 text-[10px] font-bold text-foreground">
                {participant.isHost ? "HOST" : "CO-HOST"}
              </span>
            )}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="flex items-center gap-1 rounded bg-black/40 px-1.5 py-0.5"
            title={
              participant.quality === "excellent"
                ? "Excellent connection"
                : participant.quality === "good"
                ? "Good connection"
                : "Poor connection"
            }
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                QUALITY_DOT[participant.quality] || "bg-yellow-400"
              )}
            />
          </span>
          <span className="rounded bg-black/40 p-1">
            {participant.micOn && !participant.reconnecting ? (
              <Mic className="h-3.5 w-3.5" />
            ) : (
              <MicOff className="h-3.5 w-3.5 text-red-400" />
            )}
          </span>
          <span className="rounded bg-black/40 p-1">
            {camHidden ? (
              <VideoOff className="h-3.5 w-3.5 text-red-400" />
            ) : (
              <Video className="h-3.5 w-3.5" />
            )}
          </span>
        </span>
      </div>
    </div>
  );
}
