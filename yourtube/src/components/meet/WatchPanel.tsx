import { useEffect, useRef, useState } from "react";
import { MonitorPlay, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import axiosInstance from "@/lib/axiosinstance";
import mediaUrl from "@/lib/mediaUrl";
import type { WatchState } from "@/lib/meet/types";

export function WatchStartDialog({
  open,
  onOpenChange,
  onStart,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onStart: (s: { url: string; title?: string }) => void;
}) {
  const [url, setUrl] = useState("");
  const [search, setSearch] = useState("");
  const [videos, setVideos] = useState<any[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    axiosInstance
      .get("/video/getall")
      .then((res) => {
        if (active) setVideos(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (active) setVideos([]);
      });
    return () => {
      active = false;
    };
  }, [open]);

  const filtered = (videos || []).filter(
    (v) =>
      !search ||
      (v.videotitle || "").toLowerCase().includes(search.toLowerCase())
  );

  const submit = (src: string, title?: string) => {
    onStart({ url: src, title });
    setUrl("");
    setSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Watch a video together</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste a video link (.mp4 / .webm)"
            />
            <Button
              disabled={!url.trim()}
              onClick={() => submit(url.trim())}
            >
              Start
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Or pick one of your videos:
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search videos…"
          />
          <div className="max-h-64 divide-y overflow-y-auto rounded-lg border">
            {filtered.length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">
                No videos found
              </p>
            )}
            {filtered.map((v) => {
              const src = mediaUrl(v.filepath);
              if (!src) return null;
              return (
                <button
                  key={v._id}
                  type="button"
                  className="flex w-full items-center gap-3 p-2 text-left transition-colors hover:bg-accent"
                  onClick={() => submit(src, v.videotitle)}
                >
                  <img
                    src={mediaUrl(v.thumbnail) || ""}
                    alt=""
                    className="h-10 w-16 shrink-0 rounded bg-muted object-cover"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {v.videotitle}
                  </span>
                  <Play className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function WatchPanel({
  watch,
  isHost,
  syncWatch,
  onStop,
}: {
  watch: WatchState;
  isHost: boolean;
  syncWatch: (playing: boolean, position: number) => void;
  onStop: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [tapToPlay, setTapToPlay] = useState(false);

  // Browsers may block autoplay-with-sound for participants. If the shared
  // video is supposed to play but this device didn't (likely blocked), let the
  // participant tap once to join in — it does not give them any other control.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || isHost || !watch.playing) {
      setTapToPlay(false);
      return;
    }
    setTapToPlay(v.paused);
    const onPlay = () => setTapToPlay(false);
    const onPause = () => {
      if (watch.playing) setTapToPlay(true);
    };
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, [watch.playing, isHost]);

  const joinPlayback = () => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {});
    setTapToPlay(false);
  };

  // Set source when the shared video starts. The host auto-plays so its own
  // play event immediately relays the new position to everyone else.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.getAttribute("src") !== watch.url) {
      v.src = watch.url;
      v.load();
      if (isHost) v.play().catch(() => {});
    }
  }, [watch.url, isHost]);

  // Participants only: apply the host's play/pause/seek commands, correcting
  // for network round-trip drift before the video reaches this device. Drift
  // is measured from the local receive timestamp (recvAt) so clock skew
  // between machines doesn't shift playback.
  useEffect(() => {
    if (isHost) return;
    const v = videoRef.current;
    if (!v) return;
    const base = watch.recvAt ?? watch.updatedAt;
    const target = watch.playing
      ? watch.position + (Date.now() - base) / 1000
      : watch.position;
    const drift = Math.abs(target - (Number.isFinite(v.currentTime) ? v.currentTime : NaN));
    try {
      if (drift > 0.8) v.currentTime = target;
    } catch {}
    if (watch.playing) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch, isHost]);

  // Host only: relay play/pause/seek events plus an every-4s drift corrector.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isHost) return;
    const emitState = () => syncWatch(!v.paused, v.currentTime);
    const onPlay = () => emitState();
    const onPause = () => emitState();
    const onSeeked = () => emitState();
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("seeked", onSeeked);
    const timer = setInterval(() => {
      if (!v.paused) emitState();
    }, 4000);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("seeked", onSeeked);
      clearInterval(timer);
    };
  }, [isHost, syncWatch]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        controls={isHost}
        controlsList="nodownload"
        className="h-full w-full"
      />
      {!isHost && tapToPlay && (
        <button
          type="button"
          onClick={joinPlayback}
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 transition-colors hover:bg-black/50"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-black shadow-xl">
            <Play className="h-6 w-6 fill-current" />
          </span>
        </button>
      )}
      {!isHost && (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-between p-3">
          <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
            <MonitorPlay className="h-3.5 w-3.5" />
            Host controls playback
          </span>
        </div>
      )}
      <div className="pointer-events-none absolute left-3 top-3 max-w-[70%] rounded-lg bg-black/50 px-2.5 py-1 backdrop-blur">
        <p className="truncate text-sm font-medium text-white">
          {watch.title || "Watch together"}
        </p>
      </div>
      {isHost && (
        <Button
          variant="destructive"
          size="sm"
          onClick={onStop}
          className="absolute right-3 top-3 gap-1.5"
        >
          <Square className="h-3.5 w-3.5 fill-current" />
          Stop
        </Button>
      )}
    </div>
  );
}