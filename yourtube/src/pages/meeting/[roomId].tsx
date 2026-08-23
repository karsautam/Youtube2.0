import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/lib/AuthContext";
import type { JoinInfo } from "@/lib/meet/types";
import { joinMeeting } from "@/lib/meet/api";
import { getMeetSession, saveMeetSession } from "@/lib/meet/socketClient";
import MeetingRoom from "@/components/meet/MeetingRoom";

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "passcode"; message?: string }
  | { status: "ready"; info: JoinInfo; passcode: string };

export default function MeetCall() {
  const router = useRouter();
  const roomId = String(router.query.roomId || "").toUpperCase();
  const { user, handlegooglesignin } = useUser();
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [passcodeInput, setPasscodeInput] = useState("");
  const [retrying, setRetrying] = useState(false);

  const attemptJoin = async (passcode?: string) => {
    if (!roomId) return;
    if (!user) {
      setState({
        status: "error",
        message: "Please sign in to join a meeting.",
      });
      return;
    }
    setRetrying(true);
    setState({ status: "loading" });
    try {
      const session = getMeetSession(roomId);
      const storedPass = session?.passcode ?? "";
      const info = await joinMeeting(roomId, user.email, passcode ?? storedPass);
      const reconnectKey = session?.reconnectKey
        ? session.reconnectKey
        : `rk-${roomId}-${user._id}-${Date.now()}`;
      saveMeetSession({
        roomId,
        token: info.token,
        passcode: info.passcodeRequired ? (passcode ?? storedPass) : "",
        reconnectKey,
      });
      setState({
        status: "ready",
        info,
        passcode: info.passcodeRequired ? (passcode ?? storedPass) : "",
      });
    } catch (err: any) {
      const status = err?.response?.status;
      const message = err?.response?.data?.message || "Could not join the meeting";
      if (status === 403) {
        setState({ status: "passcode", message });
      } else if (status === 423) {
        setState({
          status: "error",
          message: "This meeting is locked by the host.",
        });
      } else if (status === 410) {
        setState({ status: "error", message: "This meeting has ended." });
      } else if (status === 429) {
        setState({ status: "error", message });
      } else if (status === 404) {
        setState({ status: "error", message: "Meeting not found." });
      } else if (status === 401) {
        setState({
          status: "error",
          message: "Please sign in to join a meeting.",
        });
      } else {
        setState({ status: "error", message });
      }
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => {
    if (roomId && user) void attemptJoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user?.email]);

  const handleExit = () => {
    router.push("/meeting");
  };

  if (!roomId || state.status === "loading") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-white">
        <span className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <p className="text-slate-400">Loading meeting…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-950 px-4 text-center text-white">
        <h1 className="text-2xl font-semibold">Sign in to join this meeting</h1>
        <p className="max-w-md text-slate-400">
          You need a YourTube account to join. Sign in and you&apos;ll be taken
          straight into the meeting.
        </p>
        <Button
          onClick={() => void handlegooglesignin()}
          className="mt-2 bg-blue-600 hover:bg-blue-700"
        >
          Sign in to join
        </Button>
        <Button variant="ghost" onClick={handleExit} className="text-slate-400">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go to meetings
        </Button>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-950 px-4 text-center text-white">
        <ShieldAlert className="h-12 w-12 text-red-500" />
        <h1 className="text-2xl font-semibold">Cannot join meeting</h1>
        <p className="max-w-md text-slate-400">{state.message}</p>
        <Button onClick={handleExit} className="mt-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to meetings
        </Button>
      </div>
    );
  }

  if (state.status === "passcode") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-4 text-white">
        <h1 className="text-2xl font-semibold">This meeting requires a passcode</h1>
        <div className="w-full max-w-xs">
          <Input
            value={passcodeInput}
            onChange={(e) => setPasscodeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void attemptJoin(passcodeInput);
            }}
            placeholder="Enter passcode"
            className="bg-white/10 text-center font-mono tracking-widest text-white placeholder:text-slate-500"
          />
        </div>
        <Button
          disabled={!passcodeInput.trim() || retrying}
          onClick={() => void attemptJoin(passcodeInput)}
        >
          {retrying ? "Joining…" : "Join meeting"}
        </Button>
        <Button variant="ghost" onClick={handleExit} className="text-slate-400">
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden">
      <MeetingRoom
        key={`${roomId}-${state.info.user.id}`}
        roomId={roomId}
        token={state.info.token}
        user={state.info.user}
        passcode={state.passcode}
        startedAt={state.info.startedAt}
        onExit={handleExit}
      />
    </div>
  );
}
