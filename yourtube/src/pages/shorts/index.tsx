import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Pause, PlaySquare, Volume2, VolumeX } from "lucide-react";
import axiosInstance from "@/lib/axiosinstance";
import mediaUrl from "@/lib/mediaUrl";
import { registerVideo } from "@/lib/video-manager";

function ShortItem({ video }: { video: any }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [started, setStarted] = useState(false);

  const src = mediaUrl(video?.filepath);
  const poster = mediaUrl(video?.thumbnail);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) =>
        setActive(entry.isIntersecting && entry.intersectionRatio >= 0.6),
      { threshold: [0, 0.6, 1] }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    return registerVideo(v);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active && !paused) {
      void v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [active, paused]);

  return (
    <section
      ref={wrapRef}
      className="relative flex h-full w-full snap-start items-center justify-center bg-black"
    >
      <video
        ref={videoRef}
        src={src ?? undefined}
        poster={poster ?? undefined}
        loop
        playsInline
        muted={muted}
        preload="metadata"
        onPlay={() => {
          setStarted(true);
          setPaused(false);
        }}
        onPause={() => setPaused(true)}
        onClick={() => {
          const v = videoRef.current;
          if (!v) return;
          if (v.paused) void v.play().catch(() => {});
          else v.pause();
        }}
        className="h-full w-full cursor-pointer object-contain"
      />

      {!started && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="flex size-16 items-center justify-center rounded-full bg-red-600/80">
            <PlaySquare className="size-8 text-white" />
          </div>
          <span className="text-sm font-medium text-white/80">Loading…</span>
        </div>
      )}

      {paused && started && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex size-16 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-sm">
            <Pause className="size-8 fill-white text-white" />
          </div>
        </div>
      )}

      <button
        type="button"
        aria-label={muted ? "Unmute" : "Mute"}
        onClick={() => {
          const v = videoRef.current;
          if (v) v.muted = !muted;
          setMuted((m) => !m);
        }}
        className="absolute right-3 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-background/15 text-white backdrop-blur-sm transition-colors active:bg-background/30"
      >
        {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
      </button>

      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-10">
        <Link href={`/watch/${video?._id}`} className="block">
          <p className="line-clamp-2 text-sm font-semibold text-white">
            #{video?.videotitle} #shorts
          </p>
          <p className="mt-1 text-xs text-white/70">
            {video?.videochanel} • {(video?.views ?? 0).toLocaleString()} views
          </p>
        </Link>
      </div>
    </section>
  );
}

export default function Shorts() {
  const [videos, setVideos] = useState<any[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    axiosInstance
      .get("/video/getall")
      .then((res) => {
        if (!cancelled) setVideos(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) setVideos([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="scrollbar-none h-[calc(100vh-8.5rem)] snap-y snap-mandatory overflow-y-scroll overscroll-contain lg:h-[calc(100vh-54px)]">
      {videos === null ? (
        <div className="flex h-full items-center justify-center bg-black text-white">
          <Loader2 className="size-10 animate-spin" />
        </div>
      ) : videos.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 bg-black text-center text-white">
          <PlaySquare className="size-10 text-white/60" />
          <p className="font-medium">No shorts yet</p>
          <p className="text-sm text-white/50">
            Upload a video to see it here
          </p>
        </div>
      ) : (
        videos.map((video) => <ShortItem key={video._id} video={video} />)
      )}
    </main>
  );
}
