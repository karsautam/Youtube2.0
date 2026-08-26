"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback } from "./ui/avatar";
import mediaUrl from "@/lib/mediaUrl";
import { registerVideo } from "@/lib/video-manager";
import { cn } from "@/lib/utils";
import { useMiniPlayer } from "@/lib/MiniPlayerContext";
import { useRouter } from "next/router";

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export default function VideoCard({ video }: any) {
  const router = useRouter();
  const { video: miniVideo, expand, close } = useMiniPlayer();
  const views = typeof video?.views === "number" ? video.views : 0;
  const createdAt = video?.createdAt ? new Date(video.createdAt) : new Date();
  const thumbnail = mediaUrl(video?.thumbnail);
  const src = mediaUrl(video?.filepath);

  const previewRef = useRef<HTMLVideoElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hovering, setHovering] = useState(false);
  const [duration, setDuration] = useState<number>(0);

  useEffect(() => {
    const v = previewRef.current;
    if (!v) return;
    const unregister = registerVideo(v);
    return unregister;
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const stopPreview = () => {
    const v = previewRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  };

  const startPreview = () => {
    const v = previewRef.current;
    if (!v || !src) return;
    void v.play().catch(() => {});
  };

  const handleMouseEnter = () => {
    setHovering(true);
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(startPreview, 400);
  };

  const handleMouseLeave = () => {
    setHovering(false);
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = null;
    stopPreview();
  };

  const isSameAsMiniPlayer = miniVideo?.id === video?._id;

  const handleClick = (e: React.MouseEvent) => {
    if (isSameAsMiniPlayer && miniVideo) {
      e.preventDefault();
      expand();
      router.push(`/watch/${video._id}`);
      return;
    }
    if (miniVideo) {
      close();
    }
    router.push(`/watch/${video._id}`);
  };

  return (
    <div className="group cursor-pointer" onClick={handleClick}>
      <div className="space-y-3">
        <div
          className="relative aspect-video rounded-lg overflow-hidden bg-muted"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnail}
              alt={video?.videotitle}
              className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
          ) : (
            src && (
              <video
                src={src}
                className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
            )
          )}
          {src && (
            <video
              ref={previewRef}
              src={src}
              muted
              loop
              playsInline
              preload="metadata"
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-200",
                hovering ? "opacity-100" : "opacity-0"
              )}
              onLoadedMetadata={(e) =>
                setDuration(e.currentTarget.duration)
              }
            />
          )}
          {Number.isFinite(duration) && duration > 0 && (
            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1 rounded">
              {formatDuration(duration)}
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <Link href={`/channel/${video?.uploader}`} onClick={(e) => e.stopPropagation()}>
            <Avatar className="w-9 h-9 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/30">
              <AvatarFallback>{video?.videochanel?.[0] || "?"}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-base line-clamp-2 group-hover:text-blue-600">
              {video?.videotitle}
            </h3>
            <Link href={`/channel/${video?.uploader}`} onClick={(e) => e.stopPropagation()}>
              <p className="text-sm text-muted-foreground mt-1 hover:text-foreground cursor-pointer">{video?.videochanel}</p>
            </Link>
            <p className="text-sm text-muted-foreground">
              {views.toLocaleString()} views &bull;{" "}
              {formatDistanceToNow(createdAt)} ago
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
