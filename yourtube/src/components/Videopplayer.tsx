"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import {
  Captions,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize,
  Minimize,
  Moon,
  Pause,
  PictureInPicture2,
  Play,
  RectangleHorizontal,
  RectangleVertical,
  RotateCcw,
  RotateCw,
  Settings,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import mediaUrl from "@/lib/mediaUrl";
import { registerVideo } from "@/lib/video-manager";
import { useWatchProgress } from "@/lib/useWatchProgress";
import { useMiniPlayer } from "@/lib/MiniPlayerContext";
import { useVideoHistory } from "@/lib/VideoHistoryContext";
import { useRouter } from "next/router";

const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

const SLEEP_OPTIONS = [
  { kind: "off", minutes: null, label: "Off" },
  { kind: "minutes", minutes: 5, label: "5 minutes" },
  { kind: "minutes", minutes: 10, label: "10 minutes" },
  { kind: "minutes", minutes: 15, label: "15 minutes" },
  { kind: "minutes", minutes: 30, label: "30 minutes" },
  { kind: "minutes", minutes: 60, label: "1 hour" },
  { kind: "end", minutes: null, label: "End of video" },
] as const;

const CONTROL_HIDE_DELAY = 3000;
const AUTOPLAY_COUNTDOWN_SECONDS = 5;
const AUTOPLAY_STORAGE_KEY = "autoplayNext";

function qualityLabel(height?: number): string {
  if (!height) return "";
  if (height >= 2160) return "4K";
  if (height >= 1440) return "1440p";
  if (height >= 1080) return "1080p";
  if (height >= 720) return "720p";
  if (height >= 480) return "480p";
  if (height >= 360) return "360p";
  if (height >= 240) return "240p";
  return "144p";
}

function readAutoplayPref(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(AUTOPLAY_STORAGE_KEY);
    return raw === null ? true : raw === "true";
  } catch {
    return true;
  }
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

interface SubtitleTrack {
  src: string;
  lang?: string;
  label?: string;
  default?: boolean;
}

interface VideoPlayerProps {
  video: {
    _id?: string;
    videotitle?: string;
    filepath?: string;
    videochanel?: string;
    thumbnail?: string;
    qualities?: Array<{ height: number; filepath: string }>;
  };
  poster?: string | null;
  className?: string;
  isTheater?: boolean;
  onTheaterChange?: (isTheater: boolean) => void;
  subtitles?: SubtitleTrack[];
  prevVideo?: {
    _id?: string;
    videotitle?: string;
    videochanel?: string;
    thumbnail?: string;
  };
  nextVideo?: {
    _id?: string;
    videotitle?: string;
    videochanel?: string;
    thumbnail?: string;
  };
  onAutoplayNavigate?: (videoId: string) => void;
}

function ControlButton({
  label,
  onClick,
  active = false,
  className,
  children,
}: {
  label: string;
  onClick?: () => void;
  active?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md text-white/90 transition-colors hover:bg-white/10 hover:text-white sm:size-9",
        active && "text-red-500 hover:text-red-400",
        className
      )}
    >
      {children}
    </button>
  );
}

function SettingsRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-[13px] text-white/90 transition-colors hover:bg-white/10"
    >
      <span className="truncate">{label}</span>
      {value ? (
        <span className="shrink-0 text-xs text-white/50">{value}</span>
      ) : null}
      <ChevronRight className="size-4 shrink-0 text-white/40" />
    </button>
  );
}

function SubmenuBack({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="flex w-full items-center gap-1 rounded px-1.5 py-1.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
    >
      <ChevronLeft className="size-4 shrink-0" />
      <span className="truncate">{title}</span>
    </button>
  );
}

function OptionRow({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-sm text-white/90 transition-colors hover:bg-white/10",
        selected && "text-red-500"
      )}
    >
      <span className="truncate">{children}</span>
      {selected && <Check className="size-4 shrink-0" />}
    </button>
  );
}

export default function VideoPlayer({
  video,
  poster,
  className,
  isTheater: isTheaterProp,
  onTheaterChange,
  subtitles,
  prevVideo,
  nextVideo,
  onAutoplayNavigate,
}: VideoPlayerProps) {
  const router = useRouter();
  const { setVideo, resumePosition } = useMiniPlayer();
  const { push: pushHistory, updateTop, clear: clearHistory, markSkipPush } = useVideoHistory();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (video?._id) {
      (window as any).__currentVideoInfo = {
        id: video._id,
        title: video.videotitle || "Untitled",
        channel: video.videochanel || "",
        thumbnail: video.thumbnail || null,
        src: video.filepath || "",
      };
    }
    return () => {
      delete (window as any).__currentVideoInfo;
    };
  }, [video?._id, video?.videotitle, video?.videochanel, video?.thumbnail, video?.filepath]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const volumeBarRef = useRef<HTMLDivElement>(null);
  const settingsWrapRef = useRef<HTMLDivElement>(null);
  const suppressClickRef = useRef(0);
  const lastGearToggleRef = useRef(0);
  const volumeWrapRef = useRef<HTMLDivElement>(null);

  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrubbingRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchHandledRef = useRef(false);
  const centerFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const sideTapRef = useRef<{
    left: ReturnType<typeof setTimeout> | null;
    right: ReturnType<typeof setTimeout> | null;
  }>({ left: null, right: null });
  const settingsOpenRef = useRef(false);
  const volumeOpenRef = useRef(false);
  const lastVolumeRef = useRef(1);
  const resumeNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const pendingSeekRef = useRef<number | null>(null);
  const resumePlaybackRef = useRef(false);
  const sourceHeightRef = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsMenuPos, setSettingsMenuPos] = useState<{
    bottom: number;
    right: number;
    maxHeight: number;
  } | null>(null);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPip, setIsPip] = useState(false);
  const [seekHover, setSeekHover] = useState(false);
  const [hoverFraction, setHoverFraction] = useState<number | null>(null);
  const [scrubFraction, setScrubFraction] = useState<number | null>(null);
  const [internalTheater, setInternalTheater] = useState(false);
  const [subtitleTrack, setSubtitleTrack] = useState<number | "off">(() => {
    const i = (subtitles || []).findIndex((t) => t.default);
    return i >= 0 ? i : "off";
  });
  const [resumeNotice, setResumeNotice] = useState<number | null>(null);
  const [resolution, setResolution] = useState<{ w: number; h: number } | null>(
    null
  );
  const [autoplayEnabled, setAutoplayEnabledState] = useState(readAutoplayPref);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [quality, setQuality] = useState<number | "auto">("auto");
  const [settingsPanel, setSettingsPanel] = useState<
    "main" | "quality" | "speed" | "sleep" | "subtitles"
  >("main");
  const [sleepTimer, setSleepTimer] = useState<
    | { kind: "off" }
    | { kind: "minutes"; minutes: number; endsAt: number }
    | { kind: "end" }
  >({ kind: "off" });
  const [sleepRemaining, setSleepRemaining] = useState<number | null>(null);
  const [sourceHeight, setSourceHeight] = useState<number | null>(null);
  const [centerFlash, setCenterFlash] = useState<{
    type: "play" | "pause";
    id: number;
  } | null>(null);

  const src = video?.filepath ? mediaUrl(video.filepath) : null;
  const videoId = video?._id;
  const isTheater = onTheaterChange ? (isTheaterProp ?? false) : internalTheater;
  const hasCaptions = Boolean(subtitles?.length);
  const captionsEnabled = subtitleTrack !== "off";
  const posterSrc = poster || mediaUrl(video?.thumbnail);

  const qualities = useMemo(() => {
    const list: Array<{ height: number; filepath: string }> =
      video?.qualities || [];
    return [...list].sort((a, b) => b.height - a.height);
  }, [video?.qualities]);

  const qualityOptions = useMemo(() => {
    const byHeight = new Map<number, string>();
    for (const q of qualities) {
      if (!byHeight.has(q.height)) byHeight.set(q.height, q.filepath);
    }
    if (sourceHeight && video?.filepath && !byHeight.has(sourceHeight)) {
      byHeight.set(sourceHeight, video.filepath);
    }
    return [...byHeight.entries()]
      .map(([height, filepath]) => ({ height, filepath }))
      .sort((a, b) => b.height - a.height);
  }, [qualities, sourceHeight, video?.filepath]);

  const selectedQuality = qualityOptions.find((q) => q.height === quality);
  const playbackSrc =
    quality !== "auto" && selectedQuality
      ? mediaUrl(selectedQuality.filepath) ?? ""
      : src;

  const effectiveQualityLabel =
    quality === "auto"
      ? resolution?.h
        ? `Auto · ${qualityLabel(resolution.h)}`
        : ""
      : qualityLabel(quality) || `${quality}p`;

  const handleResumed = useCallback((position: number) => {
    setResumeNotice(position);
    if (resumeNoticeTimerRef.current) clearTimeout(resumeNoticeTimerRef.current);
    resumeNoticeTimerRef.current = setTimeout(() => {
      setResumeNotice(null);
    }, 4000);
  }, []);

  const getVideoRef = useCallback(() => videoRef.current, []);

  const autoPlayOnNavigateRef = useRef(false);
  const prevVideoIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (prevVideoIdRef.current !== videoId) {
      autoPlayOnNavigateRef.current = true;
    }
    prevVideoIdRef.current = videoId;
  }, [videoId]);

  const { resumeFromSaved, saveNow } = useWatchProgress(
    videoId,
    getVideoRef,
    { isPlaying: playing, onResumed: handleResumed }
  );

  const updateResolution = useCallback((v: HTMLVideoElement) => {
    if (v.videoWidth <= 0 || v.videoHeight <= 0) return;
    setResolution((prev) =>
      prev?.w === v.videoWidth && prev?.h === v.videoHeight
        ? prev
        : { w: v.videoWidth, h: v.videoHeight }
    );
  }, []);

  const toggleAutoplay = useCallback(() => {
    setAutoplayEnabledState((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(AUTOPLAY_STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  const cancelAutoplay = useCallback(() => {
    setCountdown(null);
    setEnded(true);
    setControlsVisible(true);
  }, []);

  const changeQuality = useCallback(
    (next: number | "auto") => {
      if (next === quality) return;
      const v = videoRef.current;
      if (v && Number.isFinite(v.duration) && v.duration > 0) {
        pendingSeekRef.current = v.currentTime;
        resumePlaybackRef.current = !v.paused;
      }
      cancelAutoplay();
      setQuality(next);
      setSettingsPanel("main");
    },
    [quality, cancelAutoplay]
  );

  const setSleepTimerOption = useCallback(
    (opt: (typeof SLEEP_OPTIONS)[number]) => {
      if (opt.kind === "off") {
        setSleepTimer({ kind: "off" });
        setSleepRemaining(null);
      } else if (opt.kind === "minutes") {
        const endsAt = Date.now() + (opt.minutes ?? 0) * 60_000;
        setSleepTimer({ kind: "minutes", minutes: opt.minutes ?? 0, endsAt });
        setSleepRemaining((opt.minutes ?? 0) * 60);
      } else {
        setSleepTimer({ kind: "end" });
        setSleepRemaining(null);
      }
      setSettingsPanel("main");
    },
    []
  );

  const sleepTimerLabel =
    sleepTimer.kind === "off"
      ? "Off"
      : sleepTimer.kind === "end"
        ? "End of video"
        : sleepRemaining !== null
          ? formatTime(sleepRemaining)
          : `${sleepTimer.minutes} min`;

  const isSleepSelected = (opt: (typeof SLEEP_OPTIONS)[number]) => {
    if (sleepTimer.kind !== opt.kind) return false;
    if (opt.kind === "minutes") {
      return sleepTimer.kind === "minutes" && sleepTimer.minutes === opt.minutes;
    }
    return true;
  };

  const captionsLabel =
    subtitleTrack === "off"
      ? "Off"
      : subtitles?.[subtitleTrack]?.label ||
        subtitles?.[subtitleTrack]?.lang ||
        `Track ${Number(subtitleTrack) + 1}`;

  const onAutoplayNavigateRef = useRef(onAutoplayNavigate);
  onAutoplayNavigateRef.current = onAutoplayNavigate;

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      if (nextVideo?._id && autoplayEnabled) {
        onAutoplayNavigateRef.current?.(nextVideo._id);
      }
      return;
    }
    const t = setTimeout(
      () => setCountdown((c) => (c === null ? null : c - 1)),
      1000
    );
    return () => clearTimeout(t);
  }, [countdown, nextVideo?._id, autoplayEnabled]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onResize = () => updateResolution(v);
    v.addEventListener("resize", onResize);
    return () => v.removeEventListener("resize", onResize);
  }, [updateResolution]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    return registerVideo(v);
  }, []);

  useEffect(() => {
    setResumeNotice(null);
    setEnded(false);
    setStarted(false);
    setCountdown(null);
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
    setResolution(null);
    setQuality("auto");
    setSettingsPanel("main");
    setSleepTimer({ kind: "off" });
    setSleepRemaining(null);
    setSourceHeight(null);
    sourceHeightRef.current = null;
    pendingSeekRef.current = null;
  }, [videoId]);

  useEffect(() => {
    if (!video?._id) return;
    const handleRouteChange = (url: string) => {
      if (url.startsWith(`/watch/${video._id}`)) return;
      if (url === "/" || url === "") {
        const v = videoRef.current;
        setVideo({
          id: video._id!,
          title: video.videotitle || "Untitled",
          channel: video.videochanel || "",
          thumbnail: video.thumbnail || null,
          src: video.filepath || "",
          currentTime: v?.currentTime || 0,
        });
        clearHistory();
      } else {
        setVideo(null);
      }
    };
    router.events.on("routeChangeStart", handleRouteChange);
    return () => {
      router.events.off("routeChangeStart", handleRouteChange);
    };
  }, [video?._id, setVideo, clearHistory]);

  useEffect(() => {
    if (!settingsOpen || !settingsWrapRef.current) return;
    const r = settingsWrapRef.current.getBoundingClientRect();
    setSettingsMenuPos({
      bottom: Math.round(window.innerHeight - r.top + 6),
      right: Math.max(8, Math.round(window.innerWidth - r.right)),
      maxHeight: Math.round(
        Math.max(160, Math.min(window.innerHeight * 0.6, r.top - 12))
      ),
    });
  }, [settingsOpen]);

  const scheduleControlsHide = useCallback(() => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      const v = videoRef.current;
      if (
        v &&
        !v.paused &&
        !scrubbingRef.current &&
        !settingsOpenRef.current &&
        !volumeOpenRef.current
      ) {
        setControlsVisible(false);
        setSettingsOpen(false);
        setVolumeOpen(false);
      }
    }, CONTROL_HIDE_DELAY);
  }, []);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    scheduleControlsHide();
  }, [scheduleControlsHide]);

  useEffect(() => {
    if (sleepTimer.kind !== "minutes") return;
    const id = window.setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((sleepTimer.endsAt - Date.now()) / 1000)
      );
      setSleepRemaining(remaining);
      if (remaining <= 0) {
        window.clearInterval(id);
        setSleepTimer({ kind: "off" });
        setSleepRemaining(null);
        const v = videoRef.current;
        if (v && !v.paused) v.pause();
        showControls();
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [sleepTimer, showControls]);

  useEffect(() => {
    settingsOpenRef.current = settingsOpen;
    if (!settingsOpen) setSettingsPanel("main");
  }, [settingsOpen]);

  useEffect(() => {
    volumeOpenRef.current = volumeOpen;
  }, [volumeOpen]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (settingsOpen && !settingsWrapRef.current?.contains(target)) {
        setSettingsOpen(false);
      }
      if (volumeOpen && !volumeWrapRef.current?.contains(target)) {
        setVolumeOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [settingsOpen, volumeOpen]);

  useEffect(() => {
    const onFsChange = () =>
      setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onEnterPip = () => setIsPip(true);
    const onLeavePip = () => setIsPip(false);
    v.addEventListener("enterpictureinpicture", onEnterPip);
    v.addEventListener("leavepictureinpicture", onLeavePip);
    return () => {
      v.removeEventListener("enterpictureinpicture", onEnterPip);
      v.removeEventListener("leavepictureinpicture", onLeavePip);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v) {
        const t = v.currentTime;
        setCurrentTime((prev) => (Math.abs(prev - t) > 0.03 ? t : prev));
        const d = v.duration || 0;
        setDuration((prev) => (Math.abs(prev - d) > 0.1 ? d : prev));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      if (resumeNoticeTimerRef.current)
        clearTimeout(resumeNoticeTimerRef.current);
      if (centerFlashTimerRef.current)
        clearTimeout(centerFlashTimerRef.current);
      if (sideTapRef.current.left) clearTimeout(sideTapRef.current.left);
      if (sideTapRef.current.right) clearTimeout(sideTapRef.current.right);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (countdown !== null) cancelAutoplay();
    if (v.paused || v.ended) {
      void v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [countdown, cancelAutoplay]);

  const skip = useCallback((seconds: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration)) return;
    cancelAutoplay();
    v.currentTime = Math.min(Math.max(v.currentTime + seconds, 0), v.duration);
    setCurrentTime(v.currentTime);
  }, [cancelAutoplay]);

  const setVideoVolume = useCallback((value: number) => {
    const v = videoRef.current;
    if (!v) return;
    const next = Math.min(1, Math.max(0, value));
    v.volume = next;
    if (next > 0) v.muted = false;
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.muted) {
      v.muted = false;
      v.volume = lastVolumeRef.current;
    } else {
      lastVolumeRef.current = v.volume;
      v.muted = true;
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen?.().catch(() => {});
    }
  }, []);

  const togglePip = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (document.pictureInPictureElement) {
      void document.exitPictureInPicture().catch(() => {});
    } else {
      void v.requestPictureInPicture?.().catch(() => {});
    }
  }, []);

  const changeSpeed = useCallback((rate: number) => {
    const v = videoRef.current;
    if (v) v.playbackRate = rate;
    setSpeed(rate);
  }, []);

  const toggleTheater = useCallback(() => {
    const next = !isTheater;
    if (onTheaterChange) {
      onTheaterChange(next);
    } else {
      setInternalTheater(next);
    }
  }, [isTheater, onTheaterChange]);

  const selectSubtitle = useCallback((index: number | "off") => {
    const v = videoRef.current;
    if (!v || !v.textTracks || v.textTracks.length === 0) return;
    for (let i = 0; i < v.textTracks.length; i++) {
      v.textTracks[i].mode =
        index !== "off" && i === index ? "showing" : "hidden";
    }
    setSubtitleTrack(index);
  }, []);

  const toggleCaptions = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.textTracks || v.textTracks.length === 0) return;
    if (subtitleTrack !== "off") {
      selectSubtitle("off");
      return;
    }
    const defaultIndex = (subtitles || []).findIndex((t) => t.default);
    selectSubtitle(defaultIndex >= 0 ? defaultIndex : 0);
  }, [subtitleTrack, selectSubtitle, subtitles]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !v.textTracks || v.textTracks.length === 0) return;
    for (let i = 0; i < v.textTracks.length; i++) {
      v.textTracks[i].mode =
        subtitleTrack !== "off" && i === subtitleTrack ? "showing" : "hidden";
    }
  }, [subtitleTrack]);

  const handleProgress = useCallback(() => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration) || v.duration === 0) return;
    let end = 0;
    for (let i = 0; i < v.buffered.length; i++) {
      if (
        v.buffered.start(i) <= v.currentTime &&
        v.buffered.end(i) >= v.currentTime
      ) {
        end = v.buffered.end(i);
        break;
      }
    }
    setBuffered((end / v.duration) * 100);
  }, []);

  const fractionFromClientX = (clientX: number, el: HTMLDivElement | null) => {
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const seekToFraction = useCallback((fraction: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration)) return;
    v.currentTime = fraction * v.duration;
    setCurrentTime(v.currentTime);
  }, []);

  const handleSeekPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    scrubbingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const f = fractionFromClientX(e.clientX, seekBarRef.current);
    setScrubFraction(f);
    setHoverFraction(f);
    cancelAutoplay();
    seekToFraction(f);
  };

  const handleSeekPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const f = fractionFromClientX(e.clientX, seekBarRef.current);
    if (scrubbingRef.current) {
      setScrubFraction(f);
      setHoverFraction(f);
      seekToFraction(f);
    } else {
      setHoverFraction(f);
    }
  };

  const handleSeekPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    scrubbingRef.current = false;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setScrubFraction(null);
  };

  const handleVolumePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setVideoVolume(fractionFromClientX(e.clientX, volumeBarRef.current));
  };

  const handleVolumePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.buttons === 1) {
      setVideoVolume(fractionFromClientX(e.clientX, volumeBarRef.current));
    }
  };

  const flashCenter = useCallback(() => {
    if (centerFlashTimerRef.current) clearTimeout(centerFlashTimerRef.current);
    setCenterFlash({
      type: videoRef.current?.paused ? "pause" : "play",
      id: Date.now(),
    });
    centerFlashTimerRef.current = setTimeout(() => setCenterFlash(null), 500);
  }, []);

  const makeZonePointerUp = (side: "left" | "right") =>
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      if (
        settingsOpenRef.current &&
        !settingsWrapRef.current?.contains(e.target as Node)
      ) {
        setSettingsOpen(false);
        return;
      }
      if (e.pointerType !== "touch") return;
      const pending = sideTapRef.current[side];
      if (pending) {
        clearTimeout(pending);
        sideTapRef.current[side] = null;
        cancelAutoplay();
        const v = videoRef.current;
        if (v && Number.isFinite(v.duration)) {
          v.currentTime = Math.min(
            Math.max(v.currentTime + (side === "left" ? -10 : 10), 0),
            v.duration
          );
          setCurrentTime(v.currentTime);
        }
      } else {
        sideTapRef.current[side] = setTimeout(() => {
          sideTapRef.current[side] = null;
          showControls();
        }, 250);
      }
    };

  const handleContainerTap = () => {
    showControls();
    containerRef.current?.focus({ preventScroll: true });
    togglePlay();
  };

  const handleContainerClick = () => {
    if (Date.now() - suppressClickRef.current < 500) {
      suppressClickRef.current = 0;
      touchHandledRef.current = false;
      return;
    }
    if (touchHandledRef.current) {
      touchHandledRef.current = false;
      return;
    }
    if (settingsOpenRef.current) {
      setSettingsOpen(false);
      return;
    }
    handleContainerTap();
  };

  const handleContainerPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (
      settingsOpenRef.current &&
      !settingsWrapRef.current?.contains(e.target as Node)
    ) {
      setSettingsOpen(false);
      suppressClickRef.current = Date.now();
    }
    if (e.pointerType === "touch") {
      touchStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleContainerPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch") return;
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("[data-video-controls]")) return;
    if (settingsOpenRef.current) {
      touchHandledRef.current = true;
      setSettingsOpen(false);
      return;
    }
    touchHandledRef.current = true;
    showControls();
  };

  const handleContainerMouseMove = () => {
    if (!controlsVisible) setControlsVisible(true);
    scheduleControlsHide();
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const key = e.key.toLowerCase();
    if (key === " ") e.preventDefault();
    switch (key) {
      case " ":
      case "k":
        togglePlay();
        break;
      case "arrowleft":
        e.preventDefault();
        skip(-5);
        break;
      case "arrowright":
        e.preventDefault();
        skip(5);
        break;
      case "arrowup":
        e.preventDefault();
        setVideoVolume(videoRef.current?.volume ?? 0 + 0.1);
        break;
      case "arrowdown":
        e.preventDefault();
        setVideoVolume(videoRef.current?.volume ?? 1 - 0.1);
        break;
      case "m":
        toggleMute();
        break;
      case "f":
        toggleFullscreen();
        break;
      case "t":
        toggleTheater();
        break;
      case "c":
        if (hasCaptions) toggleCaptions();
        break;
      case "j":
        skip(-10);
        break;
      case "l":
        skip(10);
        break;
      default:
        return;
    }
    e.stopPropagation();
  };

  if (!src) {
    return (
      <div
        className={cn(
          "flex aspect-video w-full items-center justify-center rounded-lg bg-black text-sm text-white/60",
          className
        )}
      >
        Video unavailable
      </div>
    );
  }

  const playedPct =
    duration > 0 ? ((scrubFraction ?? currentTime / duration) * 100) : 0;
  const previewFraction = scrubFraction ?? hoverFraction;
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      aria-label={video?.videotitle || "Video player"}
      onClick={handleContainerClick}
      onDoubleClick={toggleFullscreen}
      onKeyDown={handleKeyDown}
      onMouseMove={handleContainerMouseMove}
      onPointerDown={handleContainerPointerDown}
      onPointerUp={handleContainerPointerUp}
      onPointerCancel={() => {
        touchStartRef.current = null;
      }}
      className={cn(
        "video-player-root group relative aspect-video w-full select-none overflow-hidden rounded-lg bg-black outline-none",
        !controlsVisible && "cursor-none",
        isFullscreen && "rounded-none",
        className
      )}
    >
      <video
        ref={videoRef}
        src={playbackSrc ?? undefined}
        poster={posterSrc ?? undefined}
        playsInline
        preload="metadata"
        className="h-full w-full object-contain"
        onPlay={() => {
          setPlaying(true);
          setStarted(true);
          setEnded(false);
          setControlsVisible(true);
          scheduleControlsHide();
          if (video?._id) {
            pushHistory({
              id: video._id,
              title: video.videotitle || "Untitled",
              channel: video.videochanel || "",
              thumbnail: video.thumbnail || null,
              src: video.filepath || "",
              currentTime: videoRef.current?.currentTime || 0,
            });
          }
        }}
        onPause={() => {
          setPlaying(false);
          setControlsVisible(true);
          if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
          saveNow();
        }}
        onEnded={() => {
          setPlaying(false);
          setEnded(true);
          setControlsVisible(true);
          saveNow();
          if (sleepTimer.kind === "end") {
            setSleepTimer({ kind: "off" });
            return;
          }
          if (nextVideo?._id && autoplayEnabled) {
            setCountdown(AUTOPLAY_COUNTDOWN_SECONDS);
          }
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (Number.isFinite(v.duration)) setDuration(v.duration);
          updateResolution(v);
          if (quality === "auto" && v.videoHeight > 0) {
            if (sourceHeightRef.current !== v.videoHeight) {
              sourceHeightRef.current = v.videoHeight;
              setSourceHeight(v.videoHeight);
            }
          }
          if (pendingSeekRef.current !== null) {
            const t = Math.max(
              0,
              Math.min(pendingSeekRef.current, v.duration - 0.5)
            );
            pendingSeekRef.current = null;
            v.currentTime = t;
            setCurrentTime(t);
            if (resumePlaybackRef.current) {
              resumePlaybackRef.current = false;
              void v.play().catch(() => {});
            }
          } else if (resumePosition !== null && Number.isFinite(resumePosition)) {
            const t = Math.max(0, Math.min(resumePosition, v.duration - 0.5));
            v.currentTime = t;
            setCurrentTime(t);
            void v.play().catch(() => {});
          } else {
            resumeFromSaved(v);
          }
          if (autoPlayOnNavigateRef.current) {
            autoPlayOnNavigateRef.current = false;
            void v.play().catch(() => {});
          }
        }}
        onProgress={handleProgress}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume);
          setMuted(e.currentTarget.muted);
        }}
        onRateChange={(e) => setSpeed(e.currentTarget.playbackRate)}
      >
        {subtitles?.map((track, i) => (
          <track
            key={`${track.src}-${i}`}
            kind="captions"
            src={track.src}
            srcLang={track.lang || "en"}
            label={track.label || "English"}
          />
        ))}
      </video>

      {!started && (
        <div className="absolute inset-0 overflow-hidden">
          {posterSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={posterSrc}
              alt={video?.videotitle || "Video thumbnail"}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-tr from-black via-zinc-900 to-zinc-800" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-red-600/20 backdrop-blur-sm">
              <Play className="ml-0.5 size-8 fill-white text-white" />
            </div>
          </div>
        </div>
      )}

      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 z-[5] w-1/3"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={makeZonePointerUp("left")}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      />
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 z-[5] w-1/3"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={makeZonePointerUp("right")}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      />

      {centerFlash && (
        <div
          key={centerFlash.id}
          className="pointer-events-none absolute inset-0 z-[6] flex items-center justify-center"
        >
          <div className="flex size-16 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm">
            {centerFlash.type === "play" ? (
              <Play className="ml-1 size-8 fill-white text-white" />
            ) : (
              <Pause className="size-8 fill-white text-white" />
            )}
          </div>
        </div>
      )}

      {!waiting && countdown === null && started && (playing ? controlsVisible : true) && (
        <button
          type="button"
          data-video-controls
          aria-label={playing ? "Pause" : "Play"}
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
            showControls();
          }}
          className={cn(
            "absolute left-1/2 top-1/2 z-[8] flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-sm",
            playing && "lg:hidden"
          )}
        >
          {playing ? (
            <Pause className="size-8 fill-white text-white" />
          ) : (
            <Play className="ml-1 size-8 fill-white text-white" />
          )}
        </button>
      )}

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center px-4 pt-3 transition-opacity duration-300",
          !controlsVisible && "opacity-0"
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-transparent" />
        {resumeNotice !== null && (
          <span className="relative ml-2 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-red-600/90 px-2.5 py-0.5 text-[11px] font-medium text-white shadow-lg">
            <Play className="size-3 fill-white" />
            Resumed from {formatTime(resumeNotice)}
          </span>
        )}
      </div>

      {started && !playing && countdown === null && ended && (
        <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center">
          <div className="flex size-16 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-sm transition-transform duration-200 group-hover:scale-105">
            <RotateCcw className="size-8 text-white" />
          </div>
        </div>
      )}

      {waiting && (
        <div className="absolute inset-0 z-[6] flex flex-col items-center justify-center gap-3 bg-black/30">
          <Loader2 className="size-12 animate-spin text-white" />
          <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white/80">
            Buffering… {Math.round(buffered)}%
          </span>
        </div>
      )}

      {countdown !== null && nextVideo && (
        <div
          data-video-controls
          className="absolute inset-0 z-[7] flex items-center justify-center bg-black/40 px-4"
        >
          <div className="flex w-full max-w-[430px] items-center gap-3 rounded-xl border border-white/10 bg-zinc-900/95 p-3 shadow-2xl">
            <div className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-lg">
              {nextVideo.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrl(nextVideo.thumbnail) ?? undefined}
                  alt={nextVideo.videotitle || "Next video"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-tr from-black via-zinc-900 to-zinc-800" />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="relative flex size-12 items-center justify-center rounded-full border-2 border-white/30 bg-black/40">
                  <span className="text-sm font-semibold tabular-nums text-white">
                    {countdown}
                  </span>
                  <svg
                    className="absolute inset-0 size-12 -rotate-90"
                    viewBox="0 0 48 48"
                  >
                    <circle
                      cx="24"
                      cy="24"
                      r="22"
                      fill="none"
                      stroke="rgba(255,255,255,0.25)"
                      strokeWidth="3"
                    />
                    <circle
                      cx="24"
                      cy="24"
                      r="22"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 22}
                      strokeDashoffset={
                        2 *
                        Math.PI *
                        22 *
                        (1 - countdown / AUTOPLAY_COUNTDOWN_SECONDS)
                      }
                    />
                  </svg>
                </div>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/60">
                <Play className="size-3 fill-current" />
                Up next
              </div>
              <p className="mt-1 line-clamp-2 text-sm font-medium text-white">
                {nextVideo.videotitle}
              </p>
              <p className="mt-0.5 text-xs text-white/60">
                {nextVideo.videochanel}
              </p>
              <div className="mt-2.5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={cancelAutoplay}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-white/20"
                >
                  Cancel
                </button>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-white/70 select-none">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoplayEnabled}
                    onClick={toggleAutoplay}
                    className={cn(
                      "relative h-4 w-7 rounded-full transition-colors",
                      autoplayEnabled ? "bg-red-600" : "bg-white/25"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 size-3 rounded-full bg-white transition-all",
                        autoplayEnabled ? "left-3.5" : "left-0.5"
                      )}
                    />
                  </button>
                  Autoplay {autoplayEnabled ? "on" : "off"}
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        data-video-controls
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-10 px-4 pb-2 pt-10 transition-opacity duration-300",
          !controlsVisible && "opacity-0"
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        <div className="pointer-events-auto relative">
          <div
            ref={seekBarRef}
            className="group/seek relative flex h-5 w-full cursor-pointer items-center"
            onPointerDown={handleSeekPointerDown}
            onPointerMove={handleSeekPointerMove}
            onPointerUp={handleSeekPointerUp}
            onPointerLeave={() => {
              if (!scrubbingRef.current) setHoverFraction(null);
            }}
            onMouseEnter={() => setSeekHover(true)}
            onMouseLeave={() => setSeekHover(false)}
          >
            <div className="relative h-1 w-full overflow-visible rounded-full bg-white/25 transition-[height] duration-150 group-hover/seek:h-[6px]">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white/40"
                style={{ width: `${buffered}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-red-600"
                style={{ width: `${playedPct}%` }}
              />
              <div
                className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600 shadow-lg transition-opacity duration-150"
                style={{
                  left: `${playedPct}%`,
                  opacity: seekHover || scrubbingRef.current ? 1 : 0,
                }}
              />
            </div>
            {previewFraction !== null && duration > 0 && (
              <div
                className="pointer-events-none absolute bottom-5 -translate-x-1/2 rounded-md bg-black/90 px-2 py-1 text-xs font-medium tabular-nums text-white"
                style={{ left: `${previewFraction * 100}%` }}
              >
                {formatTime(previewFraction * duration)}
              </div>
            )}
          </div>
        </div>

        <div className="pointer-events-auto relative mt-1 flex items-center gap-0 sm:gap-0.5 text-white">
          <ControlButton
            label={playing ? "Pause (k)" : "Play (k)"}
            onClick={togglePlay}
          >
            {playing ? (
              <Pause className="size-[18px] fill-white sm:size-5" />
            ) : (
              <Play className="size-[18px] fill-white sm:size-5" />
            )}
          </ControlButton>
          <ControlButton label="Back 10 seconds (j)" onClick={() => skip(-10)}>
            <RotateCcw className="size-4 sm:size-5" />
          </ControlButton>
          <ControlButton label="Forward 10 seconds (l)" onClick={() => skip(10)}>
            <RotateCw className="size-4 sm:size-5" />
          </ControlButton>

          <div
            ref={volumeWrapRef}
            className="group/vol flex items-center"
            onMouseEnter={() => setVolumeOpen(true)}
            onMouseLeave={() => setVolumeOpen(false)}
          >
            <ControlButton label={muted ? "Unmute (m)" : "Mute (m)"} onClick={toggleMute}>
              <VolumeIcon className="size-[18px] sm:size-5" />
            </ControlButton>
            <div
              className={cn(
                "overflow-hidden transition-all duration-200 ease-out",
                volumeOpen ? "w-20 opacity-100" : "w-0 opacity-0"
              )}
            >
              <div
                ref={volumeBarRef}
                className="group/vs flex h-9 w-20 cursor-pointer items-center px-1"
                onPointerDown={handleVolumePointerDown}
                onPointerMove={handleVolumePointerMove}
              >
                <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/25">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-white transition-[width] duration-100"
                    style={{ width: `${(muted ? 0 : volume) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <span className="ml-1 shrink-0 text-xs font-medium tabular-nums text-white/90 sm:ml-2">
            {formatTime(currentTime)} / {formatTime(duration)}
            {duration > 0 && currentTime > 0 && (
              <span className="ml-1 hidden text-white/50 sm:inline">
                (−{formatTime(duration - currentTime)})
              </span>
            )}
          </span>

          <div className="ml-auto flex items-center gap-0.5">
            {effectiveQualityLabel && (
              <span
                className="mr-2 hidden text-[11px] font-medium tabular-nums text-white/60 sm:block"
                title={`Video resolution ${resolution?.w}×${resolution?.h}`}
              >
                {effectiveQualityLabel}
              </span>
            )}
            <span className="mr-1 hidden text-[11px] font-medium tabular-nums text-white/60 sm:block">
              {speed === 1 ? "1×" : `${speed}×`}
            </span>
            {sleepTimer.kind !== "off" && (
              <button
                type="button"
                aria-label="Sleep timer active"
                title={`Sleep timer: ${sleepTimerLabel}`}
                onClick={() => {
                  setSettingsOpen(true);
                  setSettingsPanel("sleep");
                }}
                className="mr-1 flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[11px] font-medium text-white/90 transition-colors hover:bg-white/20"
              >
                <Moon className="size-3.5" />
                <span className="tabular-nums">
                  {sleepTimer.kind === "end"
                    ? "End"
                    : formatTime(sleepRemaining ?? 0)}
                </span>
              </button>
            )}
            <div className="relative" ref={settingsWrapRef}>
              <ControlButton
                label="Settings"
                active={settingsOpen}
                onClick={() => {
                  const now = Date.now();
                  if (now - lastGearToggleRef.current < 350) return;
                  lastGearToggleRef.current = now;
                  setSettingsOpen((o) => !o);
                }}
              >
                <Settings className="size-[18px] sm:size-5" />
              </ControlButton>
              {settingsOpen && (
                <div
                  className="fixed z-50 w-56 touch-pan-y overflow-y-auto overscroll-contain rounded-lg border border-white/10 bg-black/90 p-1 shadow-2xl backdrop-blur-md"
                  style={
                    settingsMenuPos
                      ? {
                          bottom: settingsMenuPos.bottom,
                          right: settingsMenuPos.right,
                          maxHeight: settingsMenuPos.maxHeight,
                        }
                      : undefined
                  }
                >
                  {settingsPanel === "main" && (
                    <>
                      <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/50">
                        Settings
                      </p>
                      <SettingsRow
                        label="Quality"
                        value={effectiveQualityLabel || undefined}
                        onClick={() => setSettingsPanel("quality")}
                      />
                      <SettingsRow
                        label="Playback speed"
                        value={speed === 1 ? "Normal" : `${speed}×`}
                        onClick={() => setSettingsPanel("speed")}
                      />
                      <SettingsRow
                        label="Sleep timer"
                        value={sleepTimerLabel}
                        onClick={() => setSettingsPanel("sleep")}
                      />
                      {hasCaptions && (
                        <SettingsRow
                          label="Subtitles / CC"
                          value={captionsLabel}
                          onClick={() => setSettingsPanel("subtitles")}
                        />
                      )}
                      <div className="flex items-center justify-between border-t border-white/10 px-2 pt-2 text-sm text-white/90">
                        <span>Autoplay next</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={autoplayEnabled}
                          onClick={toggleAutoplay}
                          className={cn(
                            "relative h-4 w-7 rounded-full transition-colors",
                            autoplayEnabled ? "bg-red-600" : "bg-white/25"
                          )}
                        >
                          <span
                            className={cn(
                              "absolute top-0.5 size-3 rounded-full bg-white transition-all",
                              autoplayEnabled ? "left-3.5" : "left-0.5"
                            )}
                          />
                        </button>
                      </div>
                    </>
                  )}

                  {settingsPanel === "quality" && (
                    <>
                      <SubmenuBack
                        title="Quality"
                        onBack={() => setSettingsPanel("main")}
                      />
                      <div className="my-1 border-t border-white/10" />
                      <OptionRow
                        selected={quality === "auto"}
                        onClick={() => changeQuality("auto")}
                      >
                        Auto
                        {resolution?.h ? ` (${qualityLabel(resolution.h)})` : ""}
                      </OptionRow>
                      {qualityOptions.map((q) => (
                        <OptionRow
                          key={q.height}
                          selected={quality === q.height}
                          onClick={() => changeQuality(q.height)}
                        >
                          {qualityLabel(q.height) || `${q.height}p`}
                        </OptionRow>
                      ))}
                    </>
                  )}

                  {settingsPanel === "speed" && (
                    <>
                      <SubmenuBack
                        title="Playback speed"
                        onBack={() => setSettingsPanel("main")}
                      />
                      <div className="my-1 border-t border-white/10" />
                      {PLAYBACK_SPEEDS.map((rate) => (
                        <OptionRow
                          key={rate}
                          selected={rate === speed}
                          onClick={() => changeSpeed(rate)}
                        >
                          {rate === 1 ? "Normal" : `${rate}×`}
                        </OptionRow>
                      ))}
                    </>
                  )}

                  {settingsPanel === "sleep" && (
                    <>
                      <SubmenuBack
                        title="Sleep timer"
                        onBack={() => setSettingsPanel("main")}
                      />
                      <div className="my-1 border-t border-white/10" />
                      {SLEEP_OPTIONS.map((opt) => (
                        <OptionRow
                          key={`${opt.kind}-${opt.minutes ?? ""}`}
                          selected={isSleepSelected(opt)}
                          onClick={() => setSleepTimerOption(opt)}
                        >
                          {opt.label}
                        </OptionRow>
                      ))}
                    </>
                  )}

                  {settingsPanel === "subtitles" && (
                    <>
                      <SubmenuBack
                        title="Subtitles / CC"
                        onBack={() => setSettingsPanel("main")}
                      />
                      <div className="my-1 border-t border-white/10" />
                      <OptionRow
                        selected={subtitleTrack === "off"}
                        onClick={() => selectSubtitle("off")}
                      >
                        Off
                      </OptionRow>
                      {subtitles?.map((track, i) => (
                        <OptionRow
                          key={`${track.src}-${i}`}
                          selected={subtitleTrack === i}
                          onClick={() => selectSubtitle(i)}
                        >
                          {track.label || track.lang || `Track ${i + 1}`}
                        </OptionRow>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
            {hasCaptions && (
              <ControlButton
                label={
                  captionsEnabled ? "Captions off (c)" : "Captions on (c)"
                }
                active={captionsEnabled}
                onClick={toggleCaptions}
              >
                <Captions
                  className={cn(
                    "size-[18px] sm:size-5",
                    captionsEnabled && "fill-current"
                  )}
                />
              </ControlButton>
            )}
            <ControlButton
              label={isTheater ? "Exit theater mode (t)" : "Theater mode (t)"}
              active={isTheater}
              onClick={toggleTheater}
              className="hidden sm:flex"
            >
              {isTheater ? (
                <RectangleVertical className="size-[18px] sm:size-5" />
              ) : (
                <RectangleHorizontal className="size-[18px] sm:size-5" />
              )}
            </ControlButton>
            <ControlButton
              label="Picture in picture"
              active={isPip}
              onClick={togglePip}
              className="hidden sm:flex"
            >
              <PictureInPicture2 className="size-[18px] sm:size-5" />
            </ControlButton>
            <ControlButton
              label={isFullscreen ? "Exit fullscreen (f)" : "Fullscreen (f)"}
              onClick={toggleFullscreen}
            >
              {isFullscreen ? (
                <Minimize className="size-[18px] sm:size-5" />
              ) : (
                <Maximize className="size-[18px] sm:size-5" />
              )}
            </ControlButton>
          </div>
        </div>
      </div>
    </div>
  );
}
