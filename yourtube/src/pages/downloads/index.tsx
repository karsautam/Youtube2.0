import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import mediaUrl from "@/lib/mediaUrl";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "â€”";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}

const planColor: Record<string, string> = {
  free: "bg-muted text-foreground",
  bronze: "bg-amber-100 text-amber-800",
  silver: "bg-slate-200 text-slate-700",
  gold: "bg-yellow-100 text-yellow-800",
};

const Downloads = () => {
  const { user } = useUser();
  const [downloads, setDownloads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?._id) {
      setLoading(false);
      return;
    }
    axiosInstance
      .get(`/download/history/${user._id}`)
      .then((res) => setDownloads(res.data.downloads || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?._id]);

  const handleDelete = async (videoId: string) => {
    if (!user?._id) return;
    try {
      await axiosInstance.delete(`/download/record/${videoId}`, {
        data: { userId: user._id },
      });
      setDownloads((prev) =>
        prev.filter((d) => String(d.videoId?._id) !== String(videoId))
      );
      toast.success("Removed from your downloads");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to remove");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-6">Downloads</h1>

        {!user ? (
          <p className="text-muted-foreground">Sign in to see your downloads.</p>
        ) : loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : downloads.length === 0 ? (
          <p className="text-muted-foreground">No downloads yet.</p>
        ) : (
          <div className="space-y-3">
            {downloads.map((d) => {
              const v = d.videoId || {};
              return (
                <div
                  key={d._id}
                  className="flex gap-3 items-center border rounded-lg p-3 hover:bg-muted transition-colors"
                >
                  <Link
                    href={`/watch/${v._id}`}
                    className="flex gap-3 items-center flex-1 min-w-0"
                  >
                    <div className="w-36 aspect-video bg-muted rounded overflow-hidden flex-shrink-0">
                      {v.thumbnail && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={mediaUrl(v.thumbnail) ?? ""}
                          alt={v.videotitle}
                          className="object-cover w-full h-full"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm line-clamp-1">
                        {v.videotitle}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Downloaded{" "}
                        {format(new Date(d.createdAt), "dd MMM yyyy, hh:mm a")}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                        <span>Size: {formatSize(d.fileSizeBytes)}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            planColor[d.plan] || planColor.free
                          }`}
                        >
                          {(d.plan || "free").toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </Link>
                  <span
                    className={`px-2 py-0.5 rounded-full border text-xs flex-shrink-0 ${
                      d.status === "completed"
                        ? "border-green-300 text-green-700"
                        : "border-red-300 text-red-600"
                    }`}
                  >
                    {d.status}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Delete from downloads"
                    className="flex-shrink-0 hover:bg-red-50 hover:text-red-600"
                    onClick={() => handleDelete(String(v._id))}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        <Button variant="ghost" asChild className="mt-6">
          <Link href="/">â† Back to home</Link>
        </Button>
      </div>
    </div>
  );
};

export default Downloads;
