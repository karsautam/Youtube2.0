import { useCallback, useEffect, useRef } from "react";
import { useUser } from "./AuthContext";
import {
  getCompletionThreshold,
  loadSavedProgress,
  MIN_RESUME_SECONDS,
  persistProgress,
  RESTART_MARGIN_SECONDS,
  SAVE_INTERVAL_MS,
  type WatchProgressData,
} from "./watch-progress";

interface UseWatchProgressOptions {
  enabled?: boolean;
  isPlaying?: boolean;
  onResumed?: (position: number) => void;
}

export function useWatchProgress(
  videoId: string | undefined,
  getVideo: () => HTMLVideoElement | null,
  { enabled = true, isPlaying = false, onResumed }: UseWatchProgressOptions = {}
) {
  const { user } = useUser();
  const savedRef = useRef<WatchProgressData | null>(null);
  const loadedRef = useRef(false);
  const appliedRef = useRef(false);
  const retryRef = useRef(false);
  const lastSavedRef = useRef(0);
  const onResumedRef = useRef(onResumed);
  onResumedRef.current = onResumed;

  const resumeFromSaved = useCallback((v: HTMLVideoElement | null) => {
    if (!v || appliedRef.current) return;
    if (!loadedRef.current) {
      retryRef.current = true;
      return;
    }
    appliedRef.current = true;
    const saved = savedRef.current;
    if (!saved) return;
    if (!Number.isFinite(v.duration) || v.duration <= 0) return;
    const threshold = getCompletionThreshold();
    const canResume =
      !saved.completed &&
      saved.position >= MIN_RESUME_SECONDS &&
      saved.position < v.duration - RESTART_MARGIN_SECONDS &&
      saved.position < v.duration * threshold;
    if (canResume) {
      v.currentTime = Math.min(saved.position, Math.max(0, v.duration - 0.5));
      onResumedRef.current?.(saved.position);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadedRef.current = false;
    appliedRef.current = false;
    retryRef.current = false;
    lastSavedRef.current = 0;
    if (!enabled || !videoId) return;
    (async () => {
      const saved = await loadSavedProgress(videoId, user?._id);
      if (cancelled) return;
      loadedRef.current = true;
      savedRef.current = saved;
      if (retryRef.current) {
        retryRef.current = false;
        resumeFromSaved(getVideo());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, videoId, user?._id, resumeFromSaved, getVideo]);

  const saveNow = useCallback(() => {
    const v = getVideo();
    if (!v || !videoId || !Number.isFinite(v.duration) || v.duration === 0) {
      return;
    }
    lastSavedRef.current = Date.now();
    const threshold = getCompletionThreshold();
    const completed = v.currentTime / v.duration >= threshold || v.ended;
    void persistProgress(videoId, user?._id, {
      position: v.currentTime,
      duration: v.duration,
      completed,
    });
  }, [getVideo, videoId, user?._id]);

  useEffect(() => {
    if (!enabled || !videoId || !isPlaying) return;
    const interval = setInterval(() => {
      if (Date.now() - lastSavedRef.current < SAVE_INTERVAL_MS) return;
      saveNow();
    }, SAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [enabled, videoId, isPlaying, saveNow]);

  useEffect(() => {
    return () => {
      if (enabled && videoId) saveNow();
    };
  }, [enabled, videoId, saveNow]);

  return { resumeFromSaved, saveNow };
}
