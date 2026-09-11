"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import mediaUrl from "@/lib/mediaUrl";
import { registerVideo } from "@/lib/video-manager";
import { cn } from "@/lib/utils";
import { useMiniPlayer } from "@/lib/MiniPlayerContext";
import { useRouter } from "next/router";
import { Check, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import { toast } from "sonner";

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export default function VideoCard({ video, manageable, onDeleted }: any) {
  const router = useRouter();
  const { video: miniVideo, expand, close } = useMiniPlayer();
  const { user } = useUser();
  const views = typeof video?.views === "number" ? video.views : 0;
  const createdAt = video?.createdAt ? new Date(video.createdAt) : new Date();
  const thumbnail = mediaUrl(video?.thumbnail);
  const src = mediaUrl(video?.filepath);

  const previewRef = useRef<HTMLVideoElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hovering, setHovering] = useState(false);
  const [duration, setDuration] = useState<number>(0);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(video?.videotitle || "");
  const [titleSaving, setTitleSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSaveTitle = async () => {
    const trimmed = titleValue.trim();
    if (!trimmed) {
      toast.error("Title cannot be empty");
      return;
    }
    if (trimmed === video?.videotitle) {
      setEditingTitle(false);
      return;
    }
    setTitleSaving(true);
    try {
      await axiosInstance.patch(`/video/update/${video._id}`, {
        userId: user._id,
        videotitle: trimmed,
      });
      toast.success("Title updated");
      setEditingTitle(false);
      video.videotitle = trimmed;
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update title");
      setTitleValue(video?.videotitle);
    } finally {
      setTitleSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this video?")) return;
    setDeleting(true);
    try {
      await axiosInstance.delete(`/video/delete/${video._id}`, {
        data: { userId: user._id },
      });
      toast.success("Video deleted");
      onDeleted?.(video._id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete video");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    const v = previewRef.current;
    if (!v) return;
    v.dataset.playerRole = "preview";
    const unregister = registerVideo(v);
    return unregister;
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

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
    <div className="group relative cursor-pointer" onClick={handleClick}>
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
        {manageable && (
          <div className="absolute top-2 right-2" ref={menuRef}>
            <button
              type="button"
              title="More options"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((o) => !o);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-10 z-10 w-48 rounded-lg border bg-background p-1 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-accent active:bg-accent"
                  onClick={() => {
                    setMenuOpen(false);
                    setTitleValue(video?.videotitle || "");
                    setEditingTitle(true);
                  }}
                >
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                  Edit title
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 active:bg-red-100"
                  onClick={() => {
                    setMenuOpen(false);
                    handleDelete();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete video
                </button>
              </div>
            )}
          </div>
        )}
        <div className="flex gap-3">
          <Link href={`/channel/${video?.uploader}`} onClick={(e) => e.stopPropagation()}>
            <Avatar className="w-9 h-9 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/30">
              {video?.uploaderImage ? (
                <AvatarImage src={video.uploaderImage} />
              ) : null}
              <AvatarFallback>{video?.videochanel?.[0] || "?"}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTitle();
                    if (e.key === "Escape") {
                      setTitleValue(video?.videotitle || "");
                      setEditingTitle(false);
                    }
                  }}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  className="w-full text-base font-medium bg-background border rounded px-2 py-1 outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  title="Save"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveTitle();
                  }}
                  disabled={titleSaving}
                  className="shrink-0 rounded-full p-1.5 text-green-600 hover:bg-accent"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Cancel"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTitleValue(video?.videotitle || "");
                    setEditingTitle(false);
                  }}
                  className="shrink-0 rounded-full p-1.5 text-red-500 hover:bg-accent"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <h3 className="font-medium text-base line-clamp-2 group-hover:text-blue-600">
                {video?.videotitle}
              </h3>
            )}
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
