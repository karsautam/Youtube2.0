import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useMiniPlayer } from "@/lib/MiniPlayerContext";
import mediaUrl from "@/lib/mediaUrl";
import { flipFrom, readRect } from "@/lib/flip";
import { X, Maximize2, Pause, Play } from "lucide-react";

export default function MiniPlayer() {
  const router = useRouter();
  const { video, close, expand, videoRef, park } = useMiniPlayer();
  const hostRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const animatingRef = useRef(false);
  const [playing, setPlaying] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [flipTransform, setFlipTransform] = useState<string | null>(null);
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);

  const isVisible =
    video && !router.pathname.startsWith(`/watch/${video.id}`);

  useLayoutEffect(() => {
    const el = videoRef.current;
    if (el) {
      const onPlaying = () => setPlaying(true);
      const onPause = () => setPlaying(false);
      el.addEventListener("playing", onPlaying);
      el.addEventListener("pause", onPause);
      return () => {
        el.removeEventListener("playing", onPlaying);
        el.removeEventListener("pause", onPause);
      };
    }
  }, [videoRef]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    const el = videoRef.current;
    if (!host || !el || !isVisible) return;

    host.appendChild(el);
    el.playsInline = true;
    el.preload = "metadata";
    const miniSrc = video?.src ? mediaUrl(video.src) : null;
    let changedSrc = false;
    if ((window as any).__videoElemSrcId !== video?.id) {
      if (miniSrc) {
        el.src = miniSrc;
        (window as any).__videoElemSrcId = video.id;
      } else {
        el.removeAttribute("src");
        (window as any).__videoElemSrcId = null;
      }
      changedSrc = true;
    }
    if (changedSrc) {
      void el.play().catch(() => {});
      setPlaying(true);
    } else {
      setPlaying(!el.paused);
    }

    const box = boxRef.current;
    const from = box ? (window as any).__videoRect : null;
    let flipDone: (() => void) | undefined;
    if (box && from && video?.id === (window as any).__videoRectId) {
      animatingRef.current = true;
      flipDone = flipFrom(box, from, {
        duration: 800,
        onDone: () => {
          animatingRef.current = false;
          setFlipTransform(null);
          setPos({ x: 0, y: 0 });
        },
      });
      if (box.style.transform) setFlipTransform(box.style.transform);
    }
    (window as any).__videoRect = null;
    (window as any).__videoRectId = null;

    return () => {
      if (flipDone) flipDone();
      if (el.parentNode === host) park();
    };
  }, [isVisible, video?.id, video?.src, videoRef, park]);

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box || !isVisible) return;
    (window as any).__miniRect = readRect(box);
  });

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) {
      void v.play().catch(() => {});
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const goBack = () => {
    if (!video) return;
    const el = videoRef.current;
    expand(el ? el.currentTime : undefined);
    router.push(`/watch/${video.id}`);
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    close();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (animatingRef.current) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: rect.left, oy: rect.top };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (animatingRef.current) return;
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    if (!dragging && Math.abs(dx) + Math.abs(dy) > 4) setDragging(true);
    if (dragging) {
      setPos({ x: dx, y: dy });
      if (boxRef.current) (window as any).__miniRect = readRect(boxRef.current);
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
      ref={boxRef}
      className="fixed z-[60] w-56 sm:w-80 rounded-xl overflow-hidden shadow-2xl border border-border bg-background"
      style={{
        bottom: 80,
        right: 16,
        transform:
          flipTransform ??
          (pos.x || pos.y ? `translate(${pos.x}px, ${pos.y}px)` : undefined),
      }}
    >
      <div
        className="relative cursor-grab active:cursor-grabbing"
        onClick={!dragging && !animatingRef.current ? goBack : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div ref={hostRef} className="w-full aspect-video bg-black pointer-events-none" />
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
      <div className="flex items-start gap-2 px-2.5 py-1.5">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium line-clamp-1">{video.title}</p>
          <p className="text-[11px] sm:text-xs text-muted-foreground">{video.channel}</p>
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