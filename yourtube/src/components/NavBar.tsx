import { useRouter } from "next/router";
import { ArrowLeft, ArrowRight, RotateCw } from "lucide-react";
import { useMiniPlayer } from "@/lib/MiniPlayerContext";
import { useVideoHistory } from "@/lib/VideoHistoryContext";
import { useUser } from "@/lib/AuthContext";
import { clearAllProgress } from "@/lib/watch-progress";

export default function NavBar() {
  const router = useRouter();
  const { setVideo } = useMiniPlayer();
  const { user } = useUser();
  const { pop, peek, size, clear, updateTop } = useVideoHistory();

  const handleBack = () => {
    const isWatchPage = router.pathname.startsWith("/watch/");
    if (!isWatchPage) {
      router.back();
      return;
    }

    const curTime = document.querySelector("video")?.currentTime || 0;

    if (size() <= 1) {
      const info = (window as any).__currentVideoInfo;
      if (info) {
        setVideo({ ...info, currentTime: curTime });
      }
      clear();
      router.push("/");
      return;
    }

    updateTop(curTime);
    pop();
    const prev = peek();
    if (prev) {
      router.push(`/watch/${prev.id}`);
    } else {
      router.push("/");
    }
  };

  return (
    <div className="hidden lg:flex items-center gap-1 px-3 h-9 bg-background border-b shrink-0 sticky top-0 z-50">
      <button
        onClick={handleBack}
        className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-accent text-muted-foreground transition-colors"
        title="Go back"
      >
        <ArrowLeft className="w-4 h-4" />
      </button>
      <button
        onClick={() => router.forward()}
        className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-accent text-muted-foreground transition-colors"
        title="Go forward"
      >
        <ArrowRight className="w-4 h-4" />
      </button>
      <button
        onClick={async () => {
          await clearAllProgress(user?._id);
          router.reload();
        }}
        className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-accent text-muted-foreground transition-transform duration-200 hover:rotate-180"
        title="Reload (clears resume progress)"
      >
        <RotateCw className="w-4 h-4" />
      </button>
    </div>
  );
}
