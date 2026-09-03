import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useRouter } from "next/router";
import { useUser } from "@/lib/AuthContext";
import MeetingRoom from "@/components/meet/MeetingRoom";
import FloatingMeeting from "@/components/meet/FloatingMeeting";
import type { MeetingUser, Participant } from "@/lib/meet/types";

export type MeetingInfo = {
  roomId: string;
  token: string;
  user: MeetingUser;
  passcode: string;
  startedAt?: string | null;
};

export type LiveMediaState = {
  micOn: boolean;
  camOn: boolean;
  localStream: MediaStream | null;
  selfSocketId: string | null;
  participants: Participant[];
  participantStreams: Record<string, MediaStream>;
};

export type MeetingContextType = {
  activeMeeting: MeetingInfo | null;
  isMinimized: boolean;
  liveMedia: LiveMediaState;
  setLiveMedia: (s: LiveMediaState) => void;
  joinMeeting: (info: MeetingInfo) => void;
  leaveMeeting: () => void;
  exitMeeting: () => void;
  minimizeMeeting: () => void;
  restoreMeeting: () => void;
  registerLeaveHandler: (fn: (() => void) | null) => void;
};

const MeetingContext = createContext<MeetingContextType | null>(null);

export function useMeetingContext() {
  const ctx = useContext(MeetingContext);
  if (!ctx) throw new Error("useMeetingContext must be used within MeetingProvider");
  return ctx;
}

export function MeetingProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user } = useUser();
  const [activeMeeting, setActiveMeeting] = useState<MeetingInfo | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [liveMedia, setLiveMedia] = useState<LiveMediaState>({
    micOn: true,
    camOn: true,
    localStream: null,
    selfSocketId: null,
    participants: [],
    participantStreams: {},
  });
  const leaveHandlerRef = useRef<(() => void) | null>(null);

  const registerLeaveHandler = useCallback((fn: (() => void) | null) => {
    leaveHandlerRef.current = fn;
  }, []);

  const isMeetPage = router.pathname.startsWith("/meeting");

  const joinMeeting = useCallback((info: MeetingInfo) => {
    setActiveMeeting((prev) =>
      prev && prev.roomId === info.roomId ? prev : info
    );
    setIsMinimized(false);
  }, []);

  const leaveMeeting = useCallback(() => {
    setActiveMeeting(null);
    setIsMinimized(false);
    setLiveMedia({
      micOn: true,
      camOn: true,
      localStream: null,
      selfSocketId: null,
      participants: [],
      participantStreams: {},
    });
  }, []);

  const minimizeMeeting = useCallback(() => {
    setIsMinimized(true);
    router.push("/");
  }, [router]);

  const exitMeeting = useCallback(() => {
    setActiveMeeting(null);
    setIsMinimized(false);
    setLiveMedia({
      micOn: true,
      camOn: true,
      localStream: null,
      selfSocketId: null,
      participants: [],
      participantStreams: {},
    });
    router.push("/");
  }, [router]);

  const restoreMeeting = useCallback(() => {
    if (!activeMeeting) return;
    setIsMinimized(false);
    router.push(`/meeting/${activeMeeting.roomId}`);
  }, [activeMeeting, router]);

  // Keep the call mounted (hidden) whenever a meeting is active so cam/mic keep
  // flowing. It is visible full-screen only on the meeting route.
  useEffect(() => {
    if (!isMeetPage && activeMeeting) setIsMinimized(true);
  }, [isMeetPage, activeMeeting]);

  // Drop the meeting if the user signs out.
  useEffect(() => {
    if (!user && activeMeeting) {
      setActiveMeeting(null);
      setLiveMedia({
        micOn: true,
        camOn: true,
        localStream: null,
        selfSocketId: null,
        participants: [],
        participantStreams: {},
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <MeetingContext.Provider
      value={{
        activeMeeting,
        isMinimized,
        liveMedia,
        setLiveMedia,
        joinMeeting,
        leaveMeeting,
        exitMeeting,
        minimizeMeeting,
        restoreMeeting,
        registerLeaveHandler,
      }}
    >
      {children}

      {activeMeeting && isMinimized && (
        <FloatingMeeting
          onRestore={restoreMeeting}
          onLeave={() => {
            if (leaveHandlerRef.current) {
              leaveHandlerRef.current();
            } else {
              exitMeeting();
            }
          }}
        />
      )}

      {activeMeeting && (
        <div
          className={
            isMeetPage && !isMinimized
              ? "fixed inset-0 z-40 h-screen w-screen overflow-hidden"
              : "hidden"
          }
        >
          <MeetingRoom
            roomId={activeMeeting.roomId}
            token={activeMeeting.token}
            user={activeMeeting.user}
            passcode={activeMeeting.passcode}
            startedAt={activeMeeting.startedAt}
            onExit={exitMeeting}
            onHome={minimizeMeeting}
          />
        </div>
      )}
    </MeetingContext.Provider>
  );
}
