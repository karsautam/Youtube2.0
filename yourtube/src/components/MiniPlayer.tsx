import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useMiniPlayer } from "@/lib/MiniPlayerContext";
import mediaUrl from "@/lib/mediaUrl";
import { X, Maximize2, Pause, Play } from "lucide-react";

export default function MiniPlayer() {
  const router = useRouter();
  const { video, close, expand } = useMiniPlayer();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);

  const isVisible =
    video && !router.pathname.startsWith(`/watch/${video.id}`);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isVisible) return;
    v.currentTime = video.currentTime || 0;
    v.play().catch(() => {});
    setPlaying(true);
  }, [isVisible, video?.id]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const goBack = () => {
    if (!video) return;
    expand();
    router.push(`/watch/${video.id}`);
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (v) v.pause();
    close();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: rect.left, oy: rect.top };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    if (!dragging && Math.abs(dx) + Math.abs(dy) > 4) setDragging(true);
    if (dragging) {
      setPos({ x: dx, y: dy });
    }
  };

  const onPointerUp = () => {
    dragStart.current = null;
    setDragging(false);
    setPos({ x: 0, y: 0 });
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed z-[60] w-72 sm:w-80 rounded-xl overflow-hidden shadow-2xl border border-border bg-background transition-transform duration-200 ease-out"
      style={{
        bottom: 80,
        right: 16,
        transform: `translate(${pos.x}px, ${pos.y}px)`,
      }}
    >
      <div
        className="relative cursor-grab active:cursor-grabbing"
        onClick={!dragging ? goBack : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <video
          ref={videoRef}
          src={mediaUrl(video.src) ?? undefined}
          className="w-full aspect-video object-cover bg-black pointer-events-none"
          playsInline
          muted={false}
        />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30">
          <div className="flex items-center gap-3">
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); togglePlay(); }}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              {playing ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); goBack(); }}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              <Maximize2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-start gap-2 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium line-clamp-1">{video.title}</p>
          <p className="text-xs text-muted-foreground">{video.channel}</p>
        </div>
        <button
          onClick={handleClose}
          className="shrink-0 p-1 rounded-full hover:bg-accent text-muted-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
