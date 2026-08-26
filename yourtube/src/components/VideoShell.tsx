import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useMiniPlayer } from "@/lib/MiniPlayerContext";
import mediaUrl from "@/lib/mediaUrl";
import { X, Maximize2, Pause, Play } from "lucide-react";

export default function VideoShell() {
  const router = useRouter();
  const { video, close, mode, setMode, videoRef } = useMiniPlayer();
  const [playing, setPlaying] = useState(true);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const dragStart = useRef<{ mx: number; my: number } | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isVisible = video && mode !== "none";
  const isMini = mode === "mini";

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !video) return;
    if (mode === "mini") {
      v.play().catch(() => {});
      setPlaying(true);
    }
  }, [mode, video?.id]);

  useEffect(() => {
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, []);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  };

  const expand = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!video) return;
    setMode("full");
    router.push(`/watch/${video.id}`);
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    close();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isMini) return;
    dragStart.current = { mx: e.clientX, my: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current || !isMini) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    if (!dragging && Math.abs(dx) + Math.abs(dy) > 4) setDragging(true);
    if (dragging) setPos({ x: dx, y: dy });
  };

  const onPointerUp = () => {
    dragStart.current = null;
    setDragging(false);
    setPos({ x: 0, y: 0 });
  };

  const onMouseEnter = () => {
    if (!isMini) return;
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  };

  const onMouseLeave = () => {
    if (!isMini) return;
    setShowControls(false);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  };

  if (!isVisible) return null;

  const videoEl = (
    <video
      ref={videoRef}
      src={mediaUrl(video?.src ?? null) ?? undefined}
      className="w-full h-full object-contain bg-black"
      playsInline
      muted={false}
    />
  );

  if (isMini) {
    return (
      <div
        className="fixed z-[60] w-72 sm:w-80 rounded-xl overflow-hidden shadow-2xl border border-border bg-background transition-transform duration-200 ease-out"
        style={{ bottom: 80, right: 16, transform: `translate(${pos.x}px, ${pos.y}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={!dragging ? expand : undefined}
      >
        <div className="aspect-video pointer-events-none">{videoEl}</div>
        {(showControls || !playing) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="flex items-center gap-3">
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={togglePlay}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-black/60 text-white hover:bg-black/80"
              >
                {playing ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
              </button>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={expand}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-black/60 text-white hover:bg-black/80"
              >
                <Maximize2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
        <div className="flex items-start gap-2 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium line-clamp-1">{video?.title}</p>
            <p className="text-xs text-muted-foreground">{video?.channel}</p>
          </div>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleClose}
            className="shrink-0 p-1 rounded-full hover:bg-accent text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full pointer-events-none">{videoEl}</div>
  );
}
