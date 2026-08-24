import ChannelHeader from "@/components/ChannelHeader";
import Channeltabs from "@/components/Channeltabs";
import ChannelVideos from "@/components/ChannelVideos";
import VideoUploader from "@/components/VideoUploader";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useState } from "react";

const index = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useUser();
  const [channel, setChannel] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("videos");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || typeof id !== "string") return;
    axiosInstance
      .get("/user/" + id)
      .then((res) => setChannel(res.data))
      .catch((err) => console.error("Failed to fetch channel:", err))
      .finally(() => setLoading(false));
  }, [id]);

  const fetchVideos = useCallback(() => {
    if (!id) return;
    axiosInstance
      .get("/video/getall")
      .then((res) =>
        setVideos(
          (res.data || []).filter(
            (v: any) => v.videochanel === channel?.channelname
          )
        )
      )
      .catch((err) => console.error("Failed to fetch videos:", err));
  }, [id, channel?.channelname]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  if (loading) {
    return <div className="flex-1 p-6 text-muted-foreground">Loading channel...</div>;
  }

  if (!channel) {
    return <div className="flex-1 p-6 text-muted-foreground">Channel not found</div>;
  }

  const isOwner = user?._id && String(user._id) === String(id);
  const tabs: Record<string, React.ReactNode> = {
    home: (
      <div className="text-center py-12 text-muted-foreground">
        <p>Welcome to {channel.channelname}</p>
        <p className="text-sm mt-1">
          Check out the Videos tab for the latest uploads.
        </p>
      </div>
    ),
    videos: <ChannelVideos videos={videos} />,
    shorts: (
      <div className="text-center py-12 text-muted-foreground">No shorts yet.</div>
    ),
    playlists: (
      <div className="text-center py-12 text-muted-foreground">No playlists yet.</div>
    ),
    community: (
      <div className="text-center py-12 text-muted-foreground">No posts yet.</div>
    ),
    about: (
      <div className="py-8 max-w-2xl">
        <h2 className="text-lg font-semibold mb-2">About</h2>
        <p className="text-muted-foreground">
          {channel.description || `This is ${channel.channelname}'s channel.`}
        </p>
      </div>
    ),
  };

  return (
    <div className="flex-1 min-h-screen bg-background">
      <div className="max-w-full mx-auto">
        <ChannelHeader channel={channel} />
        <Channeltabs activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="px-4 pb-8 pt-6">
          {activeTab === "upload" ? (
            isOwner ? (
              <VideoUploader
                channelId={typeof id === "string" ? id : undefined}
                channelName={channel?.channelname}
                onUploaded={() => {
                  fetchVideos();
                  setActiveTab("videos");
                }}
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                Only the channel owner can upload videos.
              </div>
            )
          ) : (
            tabs[activeTab] ?? tabs.videos
          )}
        </div>
      </div>
    </div>
  );
};

export default index;
