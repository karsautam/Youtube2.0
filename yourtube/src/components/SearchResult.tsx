import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ListRowSkeleton } from "@/components/ui/skeleton";
import axiosInstance from "@/lib/axiosinstance";
import mediaUrl from "@/lib/mediaUrl";

const SearchResult = ({ query }: { query: string }) => {
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);

  const q = (query || "").trim();
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);

  useEffect(() => {
    const findVideos = async () => {
      if (!q) {
        setResults([]);
        setSearched(false);
        return;
      }
      setSearched(false);
      try {
        const res = await axiosInstance.get("/video/getall");
        const all: any[] = Array.isArray(res.data) ? res.data : [];
        const filtered = all.filter((vid) => {
          if (!vid || !vid.videotitle) return false;
          const title = String(vid.videotitle).toLowerCase();
          const channel = String(vid.videochanel || "").toLowerCase();
          const target = `${title} ${channel}`;
          if (words.length === 0) return false;
          return words.every((w) => target.includes(w));
        });
        setResults(filtered);
      } catch (err) {
        console.error("Search failed", err);
        setResults([]);
      } finally {
        setSearched(true);
      }
    };
    findVideos();
  }, [q]);

  if (!q) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          Enter a search term to find videos and channels.
        </p>
      </div>
    );
  }

  if (!searched) {
    return <ListRowSkeleton count={6} />;
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">No results found</h2>
        <p className="text-muted-foreground">
          Try different keywords or remove search filters
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {results.map((video: any) => {
          const thumbnail = mediaUrl(video.thumbnail);
          const src = mediaUrl(video.filepath);
          const views = typeof video.views === "number" ? video.views : 0;
          const createdAt = video.createdAt
            ? new Date(video.createdAt)
            : new Date();
          return (
            <div key={video._id} className="flex gap-3 sm:gap-4 group">
              <Link href={`/watch/${video._id}`} className="flex-shrink-0">
                <div className="relative w-40 aspect-video bg-muted rounded-lg overflow-hidden sm:w-72 lg:w-80">
                  {thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbnail}
                      alt={video.videotitle}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : src ? (
                    <video
                      src={src}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="h-full w-full bg-muted" />
                  )}
                </div>
              </Link>

              <div className="flex-1 min-w-0 py-1">
                <Link href={`/watch/${video._id}`}>
                  <h3 className="font-medium text-lg line-clamp-2 group-hover:text-blue-600 mb-2">
                    {video.videotitle}
                  </h3>
                </Link>

                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <span>{views.toLocaleString()} views</span>
                  <span>•</span>
                  <span>{formatDistanceToNow(createdAt)} ago</span>
                </div>

                <Link
                  href={`/channel/${video.uploader}`}
                  className="flex items-center gap-2 mb-2 hover:text-blue-600"
                >
                  <Avatar className="h-6 w-6">
                    {video.uploaderImage ? (
                      <AvatarImage src={video.uploaderImage} />
                    ) : null}
                    <AvatarFallback className="text-xs">
                      {(video.videochanel || "?")[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground">
                    {video.videochanel}
                  </span>
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-center py-8">
        <p className="text-muted-foreground">
          Showing {results.length} result{results.length === 1 ? "" : "s"} for "
          {q}"
        </p>
      </div>
    </div>
  );
};

export default SearchResult;