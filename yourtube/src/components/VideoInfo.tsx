import React, { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  CheckCircle,
  Clock,
  Download,
  Lock,
  MoreHorizontal,
  Pencil,
  Share,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useUser } from "@/lib/AuthContext";
import { useMiniPlayer } from "@/lib/MiniPlayerContext";
import axiosInstance from "@/lib/axiosinstance";
import { toast } from "sonner";
import { useRouter } from "next/router";

const VideoInfo = ({ video }: any) => {
  const router = useRouter();
  const { setVideo } = useMiniPlayer();
  const [likes, setlikes] = useState(video.Like || 0);
  const [dislikes, setDislikes] = useState(video.Dislike || 0);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const { user } = useUser();
  const [isWatchLater, setIsWatchLater] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [userPlan, setUserPlan] = useState("free");
  const [moreOpen, setMoreOpen] = useState(false);
  const [downloadMenu, setDownloadMenu] = useState(false);
  const [titleInfoOpen, setTitleInfoOpen] = useState(false);
  const [sheetTop, setSheetTop] = useState(0);
  const titleRef = useRef<HTMLButtonElement>(null);

  const toggleTitleInfo = () => {
    setTitleInfoOpen((o) => {
      if (!o) {
        const el = titleRef.current;
        setSheetTop(el ? el.getBoundingClientRect().top : 0);
      }
      return !o;
    });
  };

  const goToChannel = () => {
    if (!channelOwnerId) return;
    const curTime = document.querySelector("video")?.currentTime || 0;
    const info = (window as any).__currentVideoInfo as
      | {
          id: string;
          title: string;
          channel: string;
          thumbnail: string | null;
          src: string;
        }
      | undefined;
    if (info) {
      setVideo({ ...info, currentTime: curTime });
    }
    router.push(`/channel/${channelOwnerId}`);
  };

  const PLAN_RANK: Record<string, number> = {
    free: 0,
    bronze: 1,
    silver: 2,
    gold: 3,
  };
  const TIER_NAME = ["Free", "Bronze", "Silver", "Gold"];

  const ALL_QUALITIES = [
    { label: "1080p", value: "1080", height: 1080 },
    { label: "720p", value: "720", height: 720 },
    { label: "480p", value: "480", height: 480 },
    { label: "360p", value: "360", height: 360 },
    { label: "240p", value: "240", height: 240 },
  ];

  const qualityChoices = React.useMemo(() => {
    const available = (video?.qualities || []) as Array<{
      height: number;
      filepath: string;
    }>;
    const availableMap = new Map(available.map((q) => [q.height, q.filepath]));
    const maxHeight = available.length
      ? Math.max(...available.map((q) => q.height || 0))
      : null;
    const choices: Array<{ label: string; value: string; height: number | null; filepath: string | null }> =
      [{ label: "Original", value: "original", height: maxHeight, filepath: null }];
    ALL_QUALITIES.forEach((q) =>
      choices.push({
        label: q.label,
        value: q.value,
        height: q.height,
        filepath: availableMap.get(q.height) || null,
      })
    );
    return choices;
  }, [video?.qualities]);

  const requiredRankFor = (height: number | null): number => {
    if (!Number.isFinite(height as number)) return 0;
    if ((height as number) <= 480) return 0;
    if ((height as number) <= 720) return 1;
    if ((height as number) <= 1080) return 2;
    return 3;
  };

  const channelOwnerId = video.uploader;
  const isOwner = user?._id && String(user._id) === String(channelOwnerId);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(video.videotitle || "");
  const [titleSaving, setTitleSaving] = useState(false);

  const handleSaveTitle = async () => {
    const trimmed = titleValue.trim();
    if (!trimmed) {
      toast.error("Title cannot be empty");
      return;
    }
    if (trimmed === video.videotitle) {
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
      setTitleValue(video.videotitle);
    } finally {
      setTitleSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this video?")) return;
    try {
      await axiosInstance.delete(`/video/delete/${video._id}`, {
        data: { userId: user._id },
      });
      toast.success("Video deleted");
      if (router.pathname !== "/") router.push("/");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete video");
    }
  };

  useEffect(() => {
    setlikes(video.Like || 0);
    setDislikes(video.Dislike || 0);
    setIsLiked(false);
    setIsDisliked(false);
  }, [video]);

  useEffect(() => {
    if (!channelOwnerId) return;
    axiosInstance
      .get(`/channelfollow/count/${channelOwnerId}`)
      .then((res) => setSubscriberCount(res.data.subscriberCount))
      .catch(() => {});
  }, [channelOwnerId]);

  useEffect(() => {
    if (!user?._id || !channelOwnerId) return;
    axiosInstance
      .get(`/channelfollow/check/${user._id}/${channelOwnerId}`)
      .then((res) => setIsSubscribed(res.data.subscribed))
      .catch(() => {});
  }, [user?._id, channelOwnerId]);

  const handleSubscribe = async () => {
    if (!user) {
      toast.error("Please sign in to subscribe");
      return;
    }
    try {
      const res = await axiosInstance.post("/channelfollow/toggle", {
        subscriberId: user._id,
        channelId: channelOwnerId,
      });
      setIsSubscribed(res.data.subscribed);
      setSubscriberCount(res.data.subscriberCount);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to subscribe");
    }
  };

  const formatCount = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    return n.toString();
  };

  useEffect(() => {
    const handleviews = async () => {
      if (user) {
        try {
          return await axiosInstance.post(`/history/${video._id}`, {
            userId: user?._id,
          });
        } catch (error) {
          return console.log(error);
        }
      } else {
        return await axiosInstance.post(`/history/views/${video?._id}`);
      }
    };
    handleviews();
  }, [user]);
  const handleLike = async () => {
    if (!user) return;
    try {
      const res = await axiosInstance.post(`/like/${video._id}`, {
        userId: user?._id,
      });
      if (res.data.liked) {
        if (isLiked) {
          setlikes((prev: any) => prev - 1);
          setIsLiked(false);
        } else {
          setlikes((prev: any) => prev + 1);
          setIsLiked(true);
          if (isDisliked) {
            setDislikes((prev: any) => prev - 1);
            setIsDisliked(false);
          }
        }
      }
    } catch (error) {
      console.log(error);
    }
  };
  const handleShare = async () => {
    const url = `${window.location.origin}/watch/${video._id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Could not copy link");
    }
  };
  const handleWatchLater = async () => {
    try {
      const res = await axiosInstance.post(`/watch/${video._id}`, {
        userId: user?._id,
      });
      if (res.data.watchlater) {
        setIsWatchLater(!isWatchLater);
      } else {
        setIsWatchLater(false);
      }
    } catch (error) {
      console.log(error);
    }
  };
  const handleDislike = async () => {
    if (!user) return;
    try {
      const res = await axiosInstance.post(`/like/${video._id}`, {
        userId: user?._id,
      });
      if (!res.data.liked) {
        if (isDisliked) {
          setDislikes((prev: any) => prev - 1);
          setIsDisliked(false);
        } else {
          setDislikes((prev: any) => prev + 1);
          setIsDisliked(true);
          if (isLiked) {
            setlikes((prev: any) => prev - 1);
            setIsLiked(false);
          }
        }
      }
    } catch (error) {
      console.log(error);
    }
  };
  const startVideoDownload = async (quality: string) => {
    if (!user) {
      toast.error("Please sign in to download videos");
      return;
    }
    try {
      const res = await axiosInstance.post(`/download/${video._id}`, {
        userId: user._id,
        quality,
      });
      setIsDownloaded(true);
      toast.success(
        res.data.duplicate
          ? "You downloaded this recently â€” resuming file"
          : "Download started"
      );
      window.open(
        `${axiosInstance.defaults.baseURL}${res.data.downloadUrl}`,
        "_blank"
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Download failed");
    }
  };

  const removeFromDownloads = async () => {
    if (!user) return;
    try {
      await axiosInstance.delete(`/download/record/${video._id}`, {
        data: { userId: user._id },
      });
      setIsDownloaded(false);
      toast.success("Removed from your downloads");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to remove");
    }
  };

  useEffect(() => {
    if (!user?._id || !video?._id) return;
    axiosInstance
      .get(`/download/check/${video._id}/${user._id}`)
      .then((res) => setIsDownloaded(Boolean(res.data.downloaded)))
      .catch(() => {});
    axiosInstance
      .get(`/subscription/status/${user._id}`)
      .then((res) => setUserPlan(res.data.plan || "free"))
      .catch(() => {});
  }, [user?._id, video?._id]);

  return (
    <div className="space-y-4">
      {editingTitle ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveTitle();
              if (e.key === "Escape") {
                setTitleValue(video.videotitle);
                setEditingTitle(false);
              }
            }}
            autoFocus
            className="text-base font-semibold leading-snug sm:text-xl bg-background border rounded px-2 py-1 flex-1 outline-none focus:ring-2 focus:ring-primary"
          />
          <Button size="icon" variant="ghost" onClick={handleSaveTitle} disabled={titleSaving} className="h-8 w-8 shrink-0">
            <Check className="w-4 h-4 text-green-600" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              setTitleValue(video.videotitle);
              setEditingTitle(false);
            }}
            className="h-8 w-8 shrink-0"
          >
            <X className="w-4 h-4 text-red-600" />
          </Button>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <div className="relative min-w-0 flex-1">
            <button
              type="button"
              ref={titleRef}
              onClick={toggleTitleInfo}
              className="block w-full text-left text-base font-semibold leading-snug sm:text-xl"
            >
              {video.videotitle}
            </button>
            {titleInfoOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/40 animate-in fade-in duration-150"
                  onClick={() => setTitleInfoOpen(false)}
                  aria-hidden="true"
                />
                <div
                  className="fixed inset-x-0 bottom-0 z-50 bg-background animate-in slide-in-from-bottom duration-200 sm:absolute sm:inset-x-0 sm:inset-y-auto sm:bottom-full sm:top-auto sm:mb-2 sm:w-auto sm:rounded-xl sm:border sm:bg-background sm:p-4 sm:shadow-xl sm:overflow-visible sm:transition-all"
                  style={{ top: sheetTop }}
                >
                  <div className="flex h-full flex-col">
                    <div className="flex items-center justify-between border-b px-4 py-2">
                      <span className="text-sm font-semibold sm:hidden">
                        Video details
                      </span>
                      <button
                        type="button"
                        onClick={() => setTitleInfoOpen(false)}
                        className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
                        aria-label="Close"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:overflow-visible">
                      <h2 className="mb-3 text-base font-semibold leading-snug break-words sm:pr-0">
                        {video.videotitle}
                      </h2>
                      <div className="mb-3 flex items-center justify-between gap-2 text-xs text-muted-foreground sm:text-sm">
                        <span>
                          {typeof video.views === "number"
                            ? video.views.toLocaleString()
                            : 0}{" "}
                          views
                        </span>
                        <span>
                          {likes.toLocaleString()} likes
                        </span>
                        <span>
                          {formatDistanceToNow(new Date(video.createdAt))} ago
                        </span>
                      </div>
                      <div className="truncate text-xs font-medium text-foreground sm:text-sm">
                        {video.videochanel} · {channelOwnerId || "Unknown"}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          {isOwner && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setEditingTitle(true)}
              className="h-8 w-8 shrink-0 mt-0.5"
            >
              <Pencil className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="shrink-0 rounded-full"
            onClick={goToChannel}
            aria-label="Open channel"
          >
            <Avatar className="w-10 h-10 shrink-0">
              {video.uploaderImage ? (
                <AvatarImage src={video.uploaderImage} />
              ) : null}
              <AvatarFallback>{video.videochanel?.[0]}</AvatarFallback>
            </Avatar>
          </button>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              className="block w-full truncate text-left font-medium text-sm sm:text-base hover:underline"
              onClick={goToChannel}
            >
              {video.videochanel}
            </button>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">
              {formatCount(subscriberCount)} subscribers
            </p>
          </div>
          {channelOwnerId && (
            <Button
              onClick={() => (user ? handleSubscribe() : router.push("/signin"))}
              variant={isSubscribed ? "outline" : "default"}
              className={`ml-2 h-8 shrink-0 rounded-full px-3 text-xs sm:ml-4 sm:h-9 sm:px-4 sm:text-sm ${
                isSubscribed
                  ? "bg-muted hover:bg-accent"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {isSubscribed ? "✓ Subscribed" : "Subscribe"}
            </Button>
          )}
        </div>
        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-0.5 sm:gap-2">
          <div className="hidden shrink-0 items-center bg-muted rounded-full sm:flex">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-l-full px-2.5 sm:px-3"
              onClick={handleLike}
              aria-label="Like"
              title="Like"
            >
              <ThumbsUp
                className={`w-4 h-4 mr-1.5 sm:w-5 sm:h-5 ${
                  isLiked ? "fill-foreground text-foreground" : ""
                }`}
              />
              {likes.toLocaleString()}
            </Button>
            <div className="w-px h-6 bg-muted-foreground/30" />
            <Button
              variant="ghost"
              size="sm"
              className="rounded-r-full px-2.5 sm:px-3"
              onClick={handleDislike}
              aria-label="Dislike"
              title="Dislike"
            >
              <ThumbsDown
                className={`w-4 h-4 mr-1.5 sm:w-5 sm:h-5 ${
                  isDisliked ? "fill-foreground text-foreground" : ""
                }`}
              />
              {dislikes.toLocaleString()}
            </Button>
          </div>
          <div className="flex shrink-0 items-center sm:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-foreground"
              onClick={handleLike}
              aria-label="Like"
              title="Like"
            >
              <ThumbsUp
                className={`w-5 h-5 ${
                  isLiked ? "fill-foreground text-foreground" : ""
                }`}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-foreground"
              onClick={handleDislike}
              aria-label="Dislike"
              title="Dislike"
            >
              <ThumbsDown
                className={`w-5 h-5 ${
                  isDisliked ? "fill-foreground text-foreground" : ""
                }`}
              />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="hidden shrink-0 bg-muted rounded-full px-2.5 sm:inline-flex sm:px-3"
            onClick={handleShare}
          >
            <Share className="w-4 h-4 mr-1.5 sm:w-5 sm:h-5" />
            Share
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`hidden shrink-0 bg-muted rounded-full px-2.5 sm:inline-flex sm:px-3 ${
              isDownloaded ? "text-green-700" : ""
            }`}
            onClick={() => setDownloadMenu(true)}
          >
            {isDownloaded ? (
              <CheckCircle className="w-4 h-4 mr-1.5 fill-green-100 sm:w-5 sm:h-5" />
            ) : (
              <Download className="w-4 h-4 mr-1.5 sm:w-5 sm:h-5" />
            )}
            {isDownloaded ? "Downloaded" : "Download"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`hidden shrink-0 bg-muted rounded-full px-2.5 sm:inline-flex sm:px-3 ${
              isWatchLater ? "text-primary" : ""
            }`}
            onClick={handleWatchLater}
          >
            <Clock className="w-4 h-4 mr-1.5 sm:w-5 sm:h-5" />
            {isWatchLater ? "Saved" : "Watch Later"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="More options"
            onClick={() => setMoreOpen(true)}
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground p-0"
          >
            <MoreHorizontal className="w-5 h-5" />
          </Button>
        </div>
      </div>
      <div className="bg-muted rounded-lg p-4">
        <div className="flex gap-4 text-sm font-medium mb-2">
          <span>{video.views.toLocaleString()} views</span>
          <span>{formatDistanceToNow(new Date(video.createdAt))} ago</span>
        </div>
        <div className={`text-sm ${showFullDescription ? "" : "line-clamp-3"}`}>
          <p>
            Sample video description. This would contain the actual video
            description from the database.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 p-0 h-auto font-medium"
          onClick={() => setShowFullDescription(!showFullDescription)}
        >
          {showFullDescription ? "Show less" : "Show more"}
        </Button>
      </div>

      {moreOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50 animate-in fade-in duration-200"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-background p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom duration-200 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-72 sm:rounded-xl">
            <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-muted-foreground/30 sm:hidden" />
            {downloadMenu ? (
              <>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold transition-colors hover:bg-accent active:bg-accent"
                  onClick={() => setDownloadMenu(false)}
                >
                  <Download className="w-4 h-4 text-muted-foreground" />
                  <span className="flex-1 text-left">Download quality</span>
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
                <div className="my-1 border-t" />
                {qualityChoices.map((q) => {
                  const needed = requiredRankFor(q.height);
                  const locked = (PLAN_RANK[userPlan] ?? 0) < needed;
                  return (
                    <button
                      key={q.value}
                      type="button"
                      className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-accent active:bg-accent ${
                        locked ? "opacity-60 cursor-not-allowed" : ""
                      }`}
                      onClick={() => {
                        if (locked) {
                          toast.error(
                            `${TIER_NAME[needed]} plan or higher is required for ${q.label}`
                          );
                          return;
                        }
                        setMoreOpen(false);
                        startVideoDownload(q.value);
                      }}
                    >
                      <span className="flex-1 text-left">{q.label}</span>
                      {locked && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Lock className="w-3 h-3" />
                          {TIER_NAME[needed]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-accent active:bg-accent"
                  onClick={() => {
                    setMoreOpen(false);
                    handleShare();
                  }}
                >
                  <Share className="w-5 h-5 text-muted-foreground" />
                  Copy link
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-accent active:bg-accent"
                  onClick={() => {
                    setMoreOpen(false);
                    handleWatchLater();
                  }}
                >
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  {isWatchLater ? "Remove from Watch later" : "Save to Watch later"}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-accent active:bg-accent"
            onClick={() => {
              setDownloadMenu(true);
              setMoreOpen(true);
            }}
                >
                  {isDownloaded ? (
                    <CheckCircle className="w-5 h-5 fill-green-100 text-green-700" />
                  ) : (
                    <Download className="w-5 h-5 text-muted-foreground" />
                  )}
                  {isDownloaded ? "Downloaded" : "Download"}
                </button>
                {isDownloaded && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 active:bg-red-100"
                    onClick={() => {
                      setMoreOpen(false);
                      removeFromDownloads();
                    }}
                  >
                    <Trash2 className="w-5 h-5" />
                    Remove from downloads
                  </button>
                )}
                {isOwner && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 active:bg-red-100"
                    onClick={() => {
                      setMoreOpen(false);
                      handleDelete();
                    }}
                  >
                    <Trash2 className="w-5 h-5" />
                    Delete video
                  </button>
                )}
              </>
            )}
            <div className="my-1 border-t" />
            <button
              type="button"
              className="flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold transition-colors hover:bg-accent active:bg-accent"
              onClick={() => {
                setMoreOpen(false);
                setDownloadMenu(false);
              }}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default VideoInfo;
