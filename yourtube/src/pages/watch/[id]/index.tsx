import Comments from "@/components/Comments";
import RelatedVideos from "@/components/RelatedVideos";
import VideoInfo from "@/components/VideoInfo";
import Videopplayer from "@/components/Videopplayer";
import axiosInstance from "@/lib/axiosinstance";
import BACKEND_URL from "@/lib/backendUrl";
import { notFound } from "next/navigation";
import { useRouter } from "next/router";
import React, { useEffect, useMemo, useState } from "react";

const index = () => {
  const router = useRouter();
  const { id } = router.query;
  const [videos, setvideo] = useState<any>(null);
  const [video, setvide] = useState<any>(null);
  const [loading, setloading] = useState(true);
  const [isTheater, setIsTheater] = useState(false);
  useEffect(() => {
    const fetchvideo = async () => {
      if (!id || typeof id !== "string") return;
      try {
        const res = await axiosInstance.get("/video/getall");
        const video = res.data?.filter((vid: any) => vid._id === id);
        setvideo(video[0]);
        setvide(res.data);
      } catch (error) {
        console.log(error);
      } finally {
        setloading(false);
      }
    };
    fetchvideo();
  }, [id]);
  // const relatedVideos = [
  //   {
  //     _id: "1",
  //     videotitle: "Amazing Nature Documentary",
  //     filename: "nature-doc.mp4",
  //     filetype: "video/mp4",
  //     filepath: "/videos/nature-doc.mp4",
  //     filesize: "500MB",
  //     videochanel: "Nature Channel",
  //     Like: 1250,
  //     Dislike: 50,
  //     views: 45000,
  //     uploader: "nature_lover",
  //     createdAt: new Date().toISOString(),
  //   },
  //   {
  //     _id: "2",
  //     videotitle: "Cooking Tutorial: Perfect Pasta",
  //     filename: "pasta-tutorial.mp4",
  //     filetype: "video/mp4",
  //     filepath: "/videos/pasta-tutorial.mp4",
  //     filesize: "300MB",
  //     videochanel: "Chef's Kitchen",
  //     Like: 890,
  //     Dislike: 20,
  //     views: 23000,
  //     uploader: "chef_master",
  //     createdAt: new Date(Date.now() - 86400000).toISOString(),
  //   },
  // ];
  if (loading) {
    return <div>Loading..</div>;
  }
  
  if (!videos) {
    return <div>Video not found</div>;
  }
  const allVideos: any[] = Array.isArray(video) ? video : [];
  const currentIndex = allVideos.findIndex((vid: any) => vid._id === id);
  const nextVideo =
    allVideos.length > 0
      ? allVideos[(currentIndex + 1) % allVideos.length]
      : undefined;
  const prevVideo =
    allVideos.length > 1
      ? allVideos[
          currentIndex > 0 ? currentIndex - 1 : allVideos.length - 1
        ]
      : undefined;
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl lg:p-4">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-4">
            <div className="sticky top-14 z-30 bg-background lg:static lg:top-auto lg:z-auto">
              <Videopplayer
                video={videos}
                isTheater={isTheater}
                onTheaterChange={setIsTheater}
                nextVideo={nextVideo}
                prevVideo={prevVideo}
                onAutoplayNavigate={(vid) => router.push(`/watch/${vid}`)}
                subtitles={(videos.subtitles || []).map((s: any) => ({
                  src: `${BACKEND_URL}/${s.filepath}`,
                  lang: s.lang || "en",
                  label: s.label || s.lang || "Subtitles",
                }))}
              />
            </div>
            <VideoInfo video={videos} />
            <Comments videoId={id} />
          </div>
          <aside className="space-y-4">
            <RelatedVideos
              videos={allVideos.filter(
                (vid: any, i: number) => vid._id !== id && i !== currentIndex
              )}
            />
          </aside>
        </div>
      </div>
    </div>
  );
};

export default index;
