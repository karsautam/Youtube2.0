import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

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
  expand: () => void;
}

const MiniPlayerContext = createContext<MiniPlayerContextType>({
  video: null,
  setVideo: () => {},
  close: () => {},
  resumePosition: null,
  expand: () => {},
});

export function MiniPlayerProvider({ children }: { children: ReactNode }) {
  const [video, setVideo] = useState<MiniPlayerVideo | null>(null);
  const [resumePosition, setResumePosition] = useState<number | null>(null);

  const close = useCallback(() => {
    setVideo(null);
    setResumePosition(null);
  }, []);

  const expand = useCallback(() => {
    if (video && typeof video.currentTime === "number" && Number.isFinite(video.currentTime)) {
      setResumePosition(video.currentTime);
      setVideo(null);
    }
  }, [video]);

  return (
    <MiniPlayerContext.Provider value={{ video, setVideo, close, resumePosition, expand }}>
      {children}
    </MiniPlayerContext.Provider>
  );
}

export const useMiniPlayer = () => useContext(MiniPlayerContext);
