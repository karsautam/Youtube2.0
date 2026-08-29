import HistoryContent from "@/components/HistoryContent";
import LikedContent from "@/components/LikedContent";
import { ListRowSkeleton } from "@/components/ui/skeleton";
import React, { Suspense, useEffect, useState } from "react";

const index = () => {
  return (
    <main className="flex-1 p-6">
      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">Liked videos</h1>
        <Suspense fallback={<ListRowSkeleton count={6} />}>
          <LikedContent />
        </Suspense>
      </div>
    </main>
  );
};

export default index;
