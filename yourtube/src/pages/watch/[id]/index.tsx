import Comments from "@/components/Comments";
import RelatedVideos from "@/components/RelatedVideos";
import VideoInfo from "@/components/VideoInfo";
import Videopplayer from "@/components/Videopplayer";
import axiosInstance from "@/lib/axiosinstance";
import BACKEND_URL from "@/lib/backendUrl";
import { useUser } from "@/lib/AuthContext";
import { PlayerSkeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/router";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { Crown, Lock } from "lucide-react";

const PLAN_RANK: Record<string, number> = { free: 0, bronze: 1, silver: 2, gold: 3 };
const PLAN_LABEL: Record<string, string> = { free: "Free", bronze: "Bronze", silver: "Silver", gold: "Gold" };

const index = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useUser();
  const [videos, setvideo] = useState<any>(null);
  const [video, setvide] = useState<any>(null);
  const [loading, setloading] = useState(true);
  const [isTheater, setIsTheater] = useState(false);
  const [viewerPlan, setViewerPlan] = useState<string>("free");
  const [planLoading, setPlanLoading] = useState(true);

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

  useEffect(() => {
    let cancelled = false;
    const fetchPlan = async () => {
      if (!user?._id) {
        if (!cancelled) {
          setViewerPlan("free");
          setPlanLoading(false);
        }
        return;
      }
      setPlanLoading(true);
      try {
        const res = await axiosInstance.get(`/subscription/status/${user._id}`);
        if (!cancelled) setViewerPlan(res.data?.plan || "free");
      } catch {
        if (!cancelled) setViewerPlan("free");
      } finally {
        if (!cancelled) setPlanLoading(false);
      }
    };
    fetchPlan();
    return () => {
      cancelled = true;
    };
  }, [user?._id]);
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
    return (
      <main className="flex-1 min-w-0 p-3 md:p-4">
        <div className="mx-auto max-w-[1600px]">
          <PlayerSkeleton />
        </div>
      </main>
    );
  }

  if (!videos) {
    return <div>Video not found</div>;
  }

  const requiredPlan = (videos.requiredPlan || "free").toLowerCase();
  const requiredRank = PLAN_RANK[requiredPlan] ?? 0;
  const viewerRank = PLAN_RANK[viewerPlan] ?? 0;
  const isOwner = !!(user?._id && videos.uploader && String(user._id) === String(videos.uploader));
  const isBlocked = !planLoading && requiredRank > viewerRank && !isOwner;
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
      <div className="mx-auto w-full lg:px-2">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-w-0 space-y-4">
            <div className="sticky top-14 z-30 bg-background lg:static lg:top-auto lg:z-auto">
              {planLoading ? (
                <PlayerSkeleton />
              ) : isBlocked ? (
                <div className="relative aspect-video w-full overflow-hidden rounded-xl border bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 text-white">
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
                      <Lock className="h-7 w-7" />
                    </div>
                    <h2 className="text-xl font-semibold">Members-only video</h2>
                    <p className="mt-2 max-w-md text-sm text-zinc-300">
                      This video requires a{" "}
                      <span className="font-semibold text-amber-400">
                        {PLAN_LABEL[requiredPlan] || requiredPlan}
                      </span>{" "}
                      plan or higher. Your current plan is{" "}
                      <span className="font-semibold text-white">
                        {PLAN_LABEL[viewerPlan] || viewerPlan}
                      </span>
                      .
                    </p>
                    <Link
                      href="/subscription"
                      className="mt-5 inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 transition"
                    >
                      <Crown className="h-4 w-4" />
                      Upgrade to watch
                    </Link>
                  </div>
                </div>
              ) : (
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
              )}
            </div>
            <VideoInfo video={videos} />
            <Comments videoId={id} />
          </div>
          <aside className="lg:sticky lg:top-[3.25rem] lg:max-h-[calc(100vh-3.5rem)] lg:overflow-y-auto lg:pr-1">
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
