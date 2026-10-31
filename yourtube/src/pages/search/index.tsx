import SearchResult from "@/components/SearchResult";
import { useRouter } from "next/router";

const index = () => {
  const router = useRouter();
  const { q } = router.query;
  const query = Array.isArray(q) ? q[0] : q || "";
  return (
    <div className="flex-1 p-4">
      <div className="max-w-6xl">
        {query && (
          <div className="mb-6">
            <h1 className="text-xl font-medium mb-4">
              Search results for "{query}"
            </h1>
          </div>
        )}
        <SearchResult query={query} />
      </div>
    </div>
  );
};

export default index;