import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
  type RefObject,
} from "react";

interface MiniPlayerVideo {
  id: string;
  title: string;
  channel: string;
  thumbnail: string | null;
  src: string;
  currentTime: number;
}

interface MiniPlayerContextType {
  video: MiniPlayerVideo | null;
  setVideo: (v: MiniPlayerVideo | null) => void;
  close: () => void;
  resumePosition: number | null;
  expand: (time?: number) => void;
  videoRef: RefObject<HTMLVideoElement | null>;
  park: () => void;
}

const MiniPlayerContext = createContext<MiniPlayerContextType>({
  video: null,
  setVideo: () => {},
  close: () => {},
  resumePosition: null,
  expand: () => {},
  videoRef: { current: null },
  park: () => {},
});

let sharedVideoElement: HTMLVideoElement | null = null;
function getSharedVideoElement(): HTMLVideoElement | null {
  if (typeof document === "undefined") return null;
  if (!sharedVideoElement) {
    const v = document.createElement("video");
    v.playsInline = true;
    v.preload = "metadata";
    v.className = "h-full w-full object-contain";
    v.dataset.playerRole = "main";
    sharedVideoElement = v;
  }
  return sharedVideoElement;
}

export function MiniPlayerProvider({ children }: { children: ReactNode }) {
  const [video, setVideo] = useState<MiniPlayerVideo | null>(null);
  const [resumePosition, setResumePosition] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(getSharedVideoElement());
  const parkRef = useRef<HTMLDivElement | null>(null);

  const park = useCallback(() => {
    const el = videoRef.current;
    const p = parkRef.current;
    if (!el || !p || el.parentNode === p) return;
    p.appendChild(el);
  }, []);

  useEffect(() => {
    park();
  }, [park]);

  const stop = useCallback(() => {
    const el = videoRef.current;
    if (el) {
      el.pause();
      el.removeAttribute("src");
      el.currentTime = 0;
      el.load();
    }
  }, []);

  const close = useCallback(() => {
    stop();
    setVideo(null);
    setResumePosition(null);
  }, [stop]);

  const expand = useCallback(
    (time?: number) => {
      const el = videoRef.current;
      const t =
        typeof time === "number" && Number.isFinite(time)
          ? time
          : el && Number.isFinite(el.currentTime)
            ? el.currentTime
            : video?.currentTime ?? 0;
      if (typeof t === "number" && Number.isFinite(t)) {
        setResumePosition(t);
      }
      if (video && typeof window !== "undefined") {
        const miniRect = (window as any).__miniRect as
          | { x: number; y: number; width: number; height: number }
          | null;
        if (miniRect) {
          (window as any).__expandFrom = { rect: miniRect, id: video.id };
        }
      }
      setVideo(null);
    },
    [video]
  );

  return (
    <MiniPlayerContext.Provider
      value={{ video, setVideo, close, resumePosition, expand, videoRef, park }}
    >
      {children}
      <div
        ref={parkRef}
        aria-hidden="true"
        style={{
          position: "fixed",
          width: 1,
          height: 1,
          left: -9999,
          top: 0,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      />
    </MiniPlayerContext.Provider>
  );
}

export const useMiniPlayer = () => useContext(MiniPlayerContext);