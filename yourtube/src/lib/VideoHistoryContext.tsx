import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";

interface VideoHistoryEntry {
  id: string;
  title: string;
  channel: string;
  thumbnail: string | null;
  src: string;
  currentTime: number;
}

interface VideoHistoryContextType {
  stack: VideoHistoryEntry[];
  push: (entry: VideoHistoryEntry) => void;
  pop: () => VideoHistoryEntry | null;
  peek: () => VideoHistoryEntry | null;
  updateTop: (currentTime: number) => void;
  clear: () => void;
  size: () => number;
  skipPushId: string | null;
  markSkipPush: (id: string) => void;
}

const VideoHistoryContext = createContext<VideoHistoryContextType>({
  stack: [],
  push: () => {},
  pop: () => null,
  peek: () => null,
  updateTop: () => {},
  clear: () => {},
  size: () => 0,
  skipPushId: null,
  markSkipPush: () => {},
});

export function VideoHistoryProvider({ children }: { children: ReactNode }) {
  const stackRef = useRef<VideoHistoryEntry[]>([]);
  const skipPushIdRef = useRef<string | null>(null);
  const [, rerender] = useState(0);
  const bump = () => rerender((n) => n + 1);

  const push = useCallback((entry: VideoHistoryEntry) => {
    if (skipPushIdRef.current === entry.id) {
      skipPushIdRef.current = null;
      return;
    }
    const stack = stackRef.current;
    const last = stack[stack.length - 1];
    if (last && last.id === entry.id) {
      stack[stack.length - 1] = entry;
    } else {
      stack.push(entry);
    }
    bump();
  }, []);

  const pop = useCallback(() => {
    const stack = stackRef.current;
    const entry = stack.pop();
    bump();
    return entry ?? null;
  }, []);

  const peek = useCallback(() => {
    const stack = stackRef.current;
    return stack[stack.length - 1] ?? null;
  }, []);

  const updateTop = useCallback((currentTime: number) => {
    const stack = stackRef.current;
    if (stack.length > 0) {
      stack[stack.length - 1] = { ...stack[stack.length - 1], currentTime };
    }
  }, []);

  const clear = useCallback(() => {
    stackRef.current = [];
    bump();
  }, []);

  const size = useCallback(() => stackRef.current.length, []);

  const markSkipPush = useCallback((id: string) => {
    skipPushIdRef.current = id;
  }, []);

  return (
    <VideoHistoryContext.Provider
      value={{
        stack: stackRef.current,
        push,
        pop,
        peek,
        updateTop,
        clear,
        size,
        skipPushId: skipPushIdRef.current,
        markSkipPush,
      }}
    >
      {children}
    </VideoHistoryContext.Provider>
  );
}

export const useVideoHistory = () => useContext(VideoHistoryContext);
