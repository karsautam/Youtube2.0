import axiosInstance from "./axiosinstance";

export const DEFAULT_COMPLETION_THRESHOLD = 0.9;
export const SAVE_INTERVAL_MS = 5000;
export const MIN_RESUME_SECONDS = 5;
export const RESTART_MARGIN_SECONDS = 5;

const GUEST_PREFIX = "watch-progress:";
const THRESHOLD_KEY = "watchCompletionThreshold";

export interface WatchProgressData {
  position: number;
  duration: number;
  completed: boolean;
  updatedAt: number;
}

export function getCompletionThreshold(): number {
  if (typeof window === "undefined") return DEFAULT_COMPLETION_THRESHOLD;
  try {
    const raw = window.localStorage.getItem(THRESHOLD_KEY);
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 && n <= 1
      ? n
      : DEFAULT_COMPLETION_THRESHOLD;
  } catch {
    return DEFAULT_COMPLETION_THRESHOLD;
  }
}

export function setCompletionThreshold(value: number): void {
  try {
    if (Number.isFinite(value) && value > 0 && value <= 1) {
      window.localStorage.setItem(THRESHOLD_KEY, String(value));
    }
  } catch {}
}

function guestKey(videoId: string): string {
  return `${GUEST_PREFIX}${videoId}`;
}

export function loadGuestProgress(videoId: string): WatchProgressData | null {
  try {
    const raw = window.localStorage.getItem(guestKey(videoId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WatchProgressData>;
    return {
      position: Number(parsed.position) || 0,
      duration: Number(parsed.duration) || 0,
      completed: Boolean(parsed.completed),
      updatedAt: Number(parsed.updatedAt) || 0,
    };
  } catch {
    return null;
  }
}

export function saveGuestProgress(
  videoId: string,
  data: Omit<WatchProgressData, "updatedAt">
): void {
  try {
    window.localStorage.setItem(
      guestKey(videoId),
      JSON.stringify({ ...data, updatedAt: Date.now() })
    );
  } catch {}
}

export async function loadSavedProgress(
  videoId: string,
  userId?: string
): Promise<WatchProgressData | null> {
  if (!userId) return loadGuestProgress(videoId);
  try {
    const res = await axiosInstance.get(`/progress/${userId}/${videoId}`);
    const p = res.data?.progress;
    if (!p) return null;
    return {
      position: Number(p.position) || 0,
      duration: Number(p.duration) || 0,
      completed: Boolean(p.completed),
      updatedAt: Date.parse(p.lastupdatedon) || 0,
    };
  } catch {
    return loadGuestProgress(videoId);
  }
}

export async function persistProgress(
  videoId: string,
  userId: string | undefined,
  data: Omit<WatchProgressData, "updatedAt">
): Promise<void> {
  if (!userId) {
    saveGuestProgress(videoId, data);
    return;
  }
  try {
    await axiosInstance.post(`/progress/${videoId}`, {
      userId,
      position: Math.round(data.position),
      duration: Math.round(data.duration),
      completed: data.completed,
      completionThreshold: getCompletionThreshold(),
    });
  } catch {}
}
