import React, { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import { toast } from "sonner";
import { Pencil, Check, X, Camera } from "lucide-react";

const ChannelHeader = ({ channel, onChannelUpdated }: any) => {
  const { user, login } = useUser();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(channel?.channelname || "");
  const [saving, setSaving] = useState(false);
  const [uploadingDp, setUploadingDp] = useState(false);
  const dpInputRef = useRef<HTMLInputElement>(null);

  const isOwner = user?._id && String(user._id) === String(channel?._id);

  const handleDpChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    setUploadingDp(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await axiosInstance.post("/user/upload-image", fd);
      const url = res.data.url;
      await axiosInstance.patch(`/user/update/${channel._id}`, { image: url });
      toast.success("Channel picture updated");
      login({ ...user, image: url });
      onChannelUpdated?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update picture");
    } finally {
      setUploadingDp(false);
    }
  };

  useEffect(() => {
    setNameValue(channel?.channelname || "");
  }, [channel?.channelname]);

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

  const handleSaveName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed) {
      toast.error("Channel name cannot be empty");
      return;
    }
    if (trimmed === channel.channelname) {
      setEditingName(false);
      return;
    }
    setSaving(true);
    try {
      await axiosInstance.patch(`/user/update/${channel._id}`, {
        channelname: trimmed,
      });
      toast.success("Channel name updated");
      setEditingName(false);
      onChannelUpdated?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update");
      setNameValue(channel.channelname);
    } finally {
      setSaving(false);
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
          <div className="relative">
            <Avatar className="w-20 h-20 md:w-32 md:h-32">
              <AvatarImage src={channel?.image || user?.image || undefined} />
              <AvatarFallback className="text-2xl">
                {channel?.channelname?.[0]}
              </AvatarFallback>
            </Avatar>
            {isOwner && (
              <>
                <button
                  type="button"
                  onClick={() => dpInputRef.current?.click()}
                  disabled={uploadingDp}
                  title="Change channel picture"
                  className="absolute bottom-0 right-0 rounded-full border bg-background p-1.5 shadow-md hover:bg-accent disabled:opacity-50"
                >
                  <Camera className="h-4 w-4" />
                </button>
                <input
                  ref={dpInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleDpChange}
                />
              </>
            )}
          </div>

          <div className="flex-1 space-y-2">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") {
                      setNameValue(channel.channelname);
                      setEditingName(false);
                    }
                  }}
                  autoFocus
                  className="text-2xl md:text-4xl font-bold bg-background border rounded px-2 py-1 outline-none focus:ring-2 focus:ring-primary"
                />
                <Button size="icon" variant="ghost" onClick={handleSaveName} disabled={saving}>
                  <Check className="w-5 h-5 text-green-600" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setNameValue(channel.channelname);
                    setEditingName(false);
                  }}
                >
                  <X className="w-5 h-5 text-red-600" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-4xl font-bold">{channel?.channelname}</h1>
                {isOwner && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setEditingName(true)}
                    className="h-8 w-8"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}
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
