import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useVideoHistory } from "@/lib/VideoHistoryContext";

export default function HistoryGuard() {
  const router = useRouter();
  const { wasCleared } = useVideoHistory();
  const wasClearedRef = useRef(wasCleared);

  useEffect(() => {
    wasClearedRef.current = wasCleared;
  }, [wasCleared]);

  useEffect(() => {
    router.beforePopState(({ url }) => {
      if (wasClearedRef.current && url?.startsWith("/watch/")) {
        window.location.href = "/";
        return false;
      }
      return true;
    });

    return () => {
      router.beforePopState(() => true);
    };
  }, [router]);

  return null;
}
