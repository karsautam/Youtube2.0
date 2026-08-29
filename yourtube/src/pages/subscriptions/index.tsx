import React, { useEffect, useState } from "react";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { toast } from "sonner";

const SubscriptionsPage = () => {
  const { user } = useUser();
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?._id) {
      setLoading(false);
      return;
    }
    axiosInstance
      .get(`/channelfollow/my/${user._id}`)
      .then((res) => setChannels(res.data.subscriptions))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?._id]);

  const handleUnsubscribe = async (channelId: string) => {
    if (!user?._id) return;
    try {
      const res = await axiosInstance.post("/channelfollow/toggle", {
        subscriberId: user._id,
        channelId,
      });
      if (!res.data.subscribed) {
        setChannels((prev) => prev.filter((c: any) => c._id !== channelId));
        toast.success("Unsubscribed");
      }
    } catch {
      toast.error("Failed to unsubscribe");
    }
  };

  if (!user) {
    return (
      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto text-center py-20 text-muted-foreground">
          Sign in to see your subscriptions
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-6">
      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">Subscriptions</h1>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse flex items-center gap-4 p-4">
                <div className="h-12 w-12 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-4 w-1/2 bg-muted/70" />
                </div>
                <Skeleton className="h-9 w-24 rounded-md" />
              </div>
            ))}
          </div>
        ) : channels.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg mb-2">No subscriptions yet</p>
            <p className="text-sm">Subscribe to channels you enjoy</p>
          </div>
        ) : (
          <div className="space-y-2">
            {channels
              .filter((channel: any) => channel?._id)
              .map((channel: any) => (
              <div
                key={channel._id}
                className="flex items-center gap-4 p-4 rounded-lg hover:bg-muted transition"
              >
                <Link href={`/channel/${channel._id}`}>
                  <Avatar className="w-12 h-12 cursor-pointer">
                    <AvatarFallback className="text-lg">
                      {channel.channelname?.[0]}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1">
                  <Link
                    href={`/channel/${channel._id}`}
                    className="font-medium hover:underline"
                  >
                    {channel.channelname}
                  </Link>
                  {channel.description && (
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {channel.description}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUnsubscribe(channel._id)}
                  className="text-muted-foreground"
                >
                  Subscribed
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

export default SubscriptionsPage;
