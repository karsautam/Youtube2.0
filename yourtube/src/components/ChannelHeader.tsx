import React, { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import { toast } from "sonner";

const ChannelHeader = ({ channel }: any) => {
  const { user } = useUser();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);

  useEffect(() => {
    if (!channel?._id) return;
    axiosInstance
      .get(`/channelfollow/count/${channel._id}`)
      .then((res) => setSubscriberCount(res.data.subscriberCount))
      .catch(() => {});
  }, [channel?._id]);

  useEffect(() => {
    if (!user?._id || !channel?._id || user._id === channel._id) return;
    axiosInstance
      .get(`/channelfollow/check/${user._id}/${channel._id}`)
      .then((res) => setIsSubscribed(res.data.subscribed))
      .catch(() => {});
  }, [user?._id, channel?._id]);

  const handleSubscribe = async () => {
    if (!user) {
      toast.error("Please sign in to subscribe");
      return;
    }
    try {
      const res = await axiosInstance.post("/channelfollow/toggle", {
        subscriberId: user._id,
        channelId: channel._id,
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

  return (
    <div className="w-full">
      <div className="relative h-32 md:h-48 lg:h-64 bg-gradient-to-r from-blue-400 to-purple-500 overflow-hidden"></div>

      <div className="px-4 py-6">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <Avatar className="w-20 h-20 md:w-32 md:h-32">
            <AvatarFallback className="text-2xl">
              {channel?.channelname?.[0]}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-2">
            <h1 className="text-2xl md:text-4xl font-bold">{channel?.channelname}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>@{channel?.channelname?.toLowerCase().replace(/\s+/g, "")}</span>
              <span>{formatCount(subscriberCount)} subscribers</span>
            </div>
            {channel?.description && (
              <p className="text-sm text-foreground max-w-2xl">{channel?.description}</p>
            )}
          </div>

          {user && user?._id !== channel?._id && (
            <Button
              onClick={handleSubscribe}
              variant={isSubscribed ? "outline" : "default"}
              className={
                isSubscribed
                  ? "bg-muted hover:bg-accent"
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {isSubscribed ? "Subscribed" : "Subscribe"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChannelHeader;
