import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";

interface RelatedVideosProps {
  videos: Array<{
    _id: string;
    videotitle: string;
    videochanel: string;
    views: number;
    createdAt: string;
    thumbnail?: string;
  }>;
}
import mediaUrl from "@/lib/mediaUrl";
const vid = "/video/vdo.mp4";
export default function RelatedVideos({ videos }: RelatedVideosProps) {
  return (
    <div className="space-y-2">
      {videos.map((video) => (
        <Link
          key={video._id}
          href={`/watch/${video._id}`}
          className="flex gap-2 group"
        >
          <div className="relative w-36 aspect-video bg-muted rounded overflow-hidden flex-shrink-0 sm:w-44 lg:w-46 xl:w-52">
            {video.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaUrl(video.thumbnail) ?? undefined}
                alt={video.videotitle}
                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
            ) : (
              <video
                src={vid}
                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm lg:text-[15px] line-clamp-2 group-hover:text-blue-600">
              {video.videotitle}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">{video.videochanel}</p>
            <p className="text-xs text-muted-foreground">
              {video.views.toLocaleString()} views â€¢{" "}
              {formatDistanceToNow(new Date(video.createdAt))} ago
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
