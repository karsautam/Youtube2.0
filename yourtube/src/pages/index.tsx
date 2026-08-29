import CategoryTabs from "@/components/category-tabs";
import Videogrid, { VideoSkeletonGrid } from "@/components/Videogrid";
import { Suspense } from "react";

export default function Home() {
  return (
    <main className="flex-1 p-3 md:p-4">
      <CategoryTabs />
      <Suspense fallback={<VideoSkeletonGrid />}>
        <Videogrid />
      </Suspense>
    </main>
  );
}
