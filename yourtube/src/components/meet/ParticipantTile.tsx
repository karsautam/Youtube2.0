import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Hand,
  Maximize,
  Mic,
  MicOff,
  Minimize,
  MonitorUp,
  Video,
  VideoOff,
  X,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;
    const bind = () => {
      if (!el) return;
      if (el.srcObject !== stream) el.srcObject = stream;
      el.muted = Boolean(isSelf);
      el.play().catch(() => {});
    };
    bind();
    const track = stream.getVideoTracks()[0];
    if (track) {
      const onEnd = () => bind();
      track.addEventListener("ended", onEnd);
      return () => track.removeEventListener("ended", onEnd);
    }
  }, [stream, isSelf, participant.camOn]);

  const toggleFullscreen = () => {
    setIsFullscreen((v) => !v);
  };

  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  const hasVideo = stream?.getVideoTracks().some((t) => t.readyState === "live");
  const camHidden = !hasVideo || !participant.camOn || participant.reconnecting;

  return (
    <div
      ref={containerRef}
      onClick={toggleFullscreen}
      className={cn(
        "relative aspect-video w-full cursor-pointer overflow-hidden rounded-xl bg-slate-800 border-2",
        participant.speaking && !isSelf
          ? "border-emerald-500"
          : "border-transparent"
      )}
    >
      {stream && hasVideo && participant.camOn && !participant.reconnecting ? (
        <video
          key={`cam-${participant.camOn}-${hasVideo}`}
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf}
          className={cn(
            "h-full w-full object-cover",
            isSelf && "-scale-x-100"
          )}
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

      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleFullscreen();
        }}
        title="View fullscreen"
        className="absolute right-2 top-2 z-50 flex h-8 w-8 items-center justify-center rounded-md bg-black/50 text-white shadow transition hover:bg-black/70"
      >
        <Maximize className="h-4 w-4" />
      </button>

      {isFullscreen && (
        <FullscreenView
          participant={participant}
          stream={stream}
          isSelf={isSelf}
          onClose={() => setIsFullscreen(false)}
        />
      )}

      {participant.reconnecting && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/70 text-white">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
          <span className="text-sm">Reconnecting…</span>
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

function FullscreenView({
  participant,
  stream,
  isSelf,
  onClose,
}: {
  participant: Participant;
  stream: MediaStream | null;
  isSelf?: boolean;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    el.play().catch(() => {});
  }, [stream]);

  const trackSig = stream
    ? stream
        .getVideoTracks()
        .map((t) => `${t.kind}:${t.id}:${t.muted}:${t.readyState}`)
        .join("|")
    : "";

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;
    const bind = () => {
      if (!el) return;
      if (el.srcObject !== stream) el.srcObject = stream;
      el.play().catch(() => {});
    };
    const track = stream.getVideoTracks()[0];
    if (track) {
      track.addEventListener("mute", bind);
      track.addEventListener("unmute", bind);
      track.addEventListener("ended", bind);
    }
    bind();
    return () => {
      if (track) {
        track.removeEventListener("mute", bind);
        track.removeEventListener("unmute", bind);
        track.removeEventListener("ended", bind);
      }
    };
  }, [stream, trackSig]);

  const hasVideo = stream?.getVideoTracks().some((t) => t.readyState === "live");
  const showVideo = hasVideo && participant.camOn && !participant.reconnecting;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onClose}
        title="Exit fullscreen (Esc)"
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
      >
        <Minimize className="h-5 w-5" />
      </button>

      <button
        onClick={onClose}
        title="Close"
        className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-sm text-white transition hover:bg-black/80"
      >
        <X className="h-4 w-4" />
        <span>{participant.name}</span>
      </button>

      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf}
          className={cn(
            "h-full w-full object-contain",
            isSelf && "-scale-x-100"
          )}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-black">
          <Avatar className="h-32 w-32">
            <AvatarImage src={participant.image} />
            <AvatarFallback className="text-5xl">
              {participant.name?.[0] || "?"}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
    </div>,
    document.body
  );
}

