import React, { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  CheckCircle,
  Clock,
  Download,
  Lock,
  MoreHorizontal,
  Share,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import { toast } from "sonner";

const VideoInfo = ({ video }: any) => {
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

  const PLAN_RANK: Record<string, number> = {
    free: 0,
    bronze: 1,
    silver: 2,
    gold: 3,
  };
  const TIER_NAME = ["Free", "Bronze", "Silver", "Gold"];

  const qualityChoices = React.useMemo(() => {
    const qualities = (video?.qualities || []) as Array<{
      height: number;
      filepath: string;
    }>;
    const maxHeight = qualities.length
      ? Math.max(...qualities.map((q) => q.height || 0))
      : null;
    const choices: Array<{ label: string; value: string; height: number | null }> =
      [{ label: "Original", value: "original", height: maxHeight }];
    [...qualities]
      .sort((a, b) => b.height - a.height)
      .forEach((q) =>
        choices.push({
          label: `${q.height}p`,
          value: String(q.height),
          height: q.height,
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
      <h1 className="text-base font-semibold leading-snug sm:text-xl">
        {video.videotitle}
      </h1>

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="w-10 h-10 shrink-0">
            <AvatarFallback>{video.videochanel?.[0]}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-medium text-sm sm:text-base">
              {video.videochanel}
            </h3>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">
              {formatCount(subscriberCount)} subscribers
            </p>
          </div>
          {user && channelOwnerId && (
            <Button
              onClick={handleSubscribe}
              variant={isSubscribed ? "outline" : "default"}
              className={`ml-2 h-8 shrink-0 rounded-full px-3 text-xs sm:ml-4 sm:h-9 sm:px-4 sm:text-sm ${
                isSubscribed
                  ? "bg-muted hover:bg-accent"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {isSubscribed ? "âœ“ Subscribed" : "Subscribe"}
            </Button>
          )}
        </div>
        <div className="scrollbar-none -mx-4 flex min-w-0 items-center gap-2 overflow-x-auto px-4">
          <div className="flex shrink-0 items-center bg-muted rounded-full">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-l-full px-2.5 sm:px-3"
              onClick={handleLike}
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
            >
              <ThumbsDown
                className={`w-4 h-4 mr-1.5 sm:w-5 sm:h-5 ${
                  isDisliked ? "fill-foreground text-foreground" : ""
                }`}
              />
              {dislikes.toLocaleString()}
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 bg-muted rounded-full px-2.5 sm:px-3"
            onClick={handleShare}
          >
            <Share className="w-4 h-4 mr-1.5 sm:w-5 sm:h-5" />
            Share
          </Button>
          {isDownloaded ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 bg-muted rounded-full px-2.5 text-green-700 sm:px-3"
                >
                  <CheckCircle className="w-4 h-4 mr-1.5 fill-green-100 sm:w-5 sm:h-5" />
                  Downloaded
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={removeFromDownloads}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove from downloads
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 bg-muted rounded-full px-2.5 sm:px-3"
                >
                  <Download className="w-4 h-4 mr-1.5 sm:w-5 sm:h-5" />
                  Download
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[190px]">
                {qualityChoices.map((q) => {
                  const needed = requiredRankFor(q.height);
                  const locked = (PLAN_RANK[userPlan] ?? 0) < needed;
                  return (
                    <DropdownMenuItem
                      key={q.value}
                      onClick={() =>
                        locked
                          ? toast.error(
                              `${TIER_NAME[needed]} plan or higher is required for ${q.label}`
                            )
                          : startVideoDownload(q.value)
                      }
                      className={
                        locked ? "opacity-60 cursor-not-allowed" : ""
                      }
                    >
                      <span className="flex-1">{q.label}</span>
                      {locked && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground ml-3">
                          <Lock className="w-3 h-3" />
                          {TIER_NAME[needed]}
                        </span>
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={`shrink-0 bg-muted rounded-full px-2.5 sm:px-3 ${
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
            className="shrink-0 bg-muted rounded-full"
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
            <div className="my-1 border-t" />
            <button
              type="button"
              className="flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold transition-colors hover:bg-accent active:bg-accent"
              onClick={() => setMoreOpen(false)}
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
