"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { MoreVertical, X, Clock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import axiosInstance from "@/lib/axiosinstance";
import { useUser } from "@/lib/AuthContext";
import mediaUrl from "@/lib/mediaUrl";
import { ListRowSkeleton } from "@/components/ui/skeleton";

export default function WatchLaterContent() {
  const [watchLater, setWatchLater] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useUser();

  useEffect(() => {
    if (user) {
      loadWatchLater();
    }
  }, [user]);

  const loadWatchLater = async () => {
    if (!user) return;

    try {
      const watchLaterData = await axiosInstance.get(`/watch/${user?._id}`);

      setWatchLater(watchLaterData.data);
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ListRowSkeleton count={6} />;
  }
  const handleRemoveFromWatchLater = async (watchLaterId: string) => {
    try {
      console.log("Removing from history:", watchLaterId);
      setWatchLater(watchLater.filter((item) => item._id !== watchLaterId));
    } catch (error) {
      console.error("Error removing from history:", error);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-12">
        <Clock className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Save videos for later</h2>
        <p className="text-muted-foreground">
          Sign in to access your Watch later playlist.
        </p>
      </div>
    );
  }

  if (watchLater.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No videos saved</h2>
        <p className="text-muted-foreground">
          Videos you save for later will appear here.
        </p>
      </div>
    );
  }
  const videos = "/video/vdo.mp4";
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{watchLater.length} videos</p>
        <Button className="flex items-center gap-2">
          <Play className="w-4 h-4" />
          Play all
        </Button>
      </div>

      <div className="space-y-4">
        {watchLater.map((item) => (
          <div key={item._id} className="flex flex-col gap-2 group sm:flex-row sm:gap-4">
            <Link
              href={`/watch/${item.videoid._id}`}
              className="flex-shrink-0"
            >
              <div className="relative w-full aspect-video bg-muted rounded overflow-hidden sm:w-40">
                {item.videoid?.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaUrl(item.videoid.thumbnail) ?? undefined}
                    alt={item.videoid.videotitle}
                    className="object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                ) : (
                  <video
                    src={mediaUrl(item.videoid?.filepath) ?? undefined}
                    className="object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                )}
              </div>
            </Link>

            <div className="flex items-start gap-2 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Link href={`/watch/${item.videoid._id}`}>
                  <h3 className="font-medium text-sm line-clamp-none group-hover:text-blue-600 mb-1 sm:line-clamp-2">
                    {item.videoid.videotitle}
                  </h3>
                </Link>
              <p className="text-sm text-muted-foreground">
                {item.videoid.videochanel}
              </p>
              <p className="text-sm text-muted-foreground">
                {item.videoid.views.toLocaleString()} views â€¢{" "}
                {formatDistanceToNow(new Date(item.videoid.createdAt))} ago
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Added {formatDistanceToNow(new Date(item.createdAt))} ago
              </p>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => handleRemoveFromWatchLater(item._id)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Remove from Watch later
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
