import SearchResult from "@/components/SearchResult";
import { ListRowSkeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/router";
import React, { Suspense } from "react";

const index = () => {
  const router = useRouter();
  const { q } = router.query;
  return (
    <div className="flex-1 p-4">
      <div className="max-w-6xl">
        {q && (
          <div className="mb-6">
            <h1 className="text-xl font-medium mb-4">
              Search results for "{q}"
            </h1>
          </div>
        )}
        <Suspense fallback={<ListRowSkeleton count={6} />}>
          <SearchResult query={q || ""} />
        </Suspense>
      </div>
    </div>
  );
};

export default index;
