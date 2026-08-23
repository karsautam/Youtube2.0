import { useState } from "react";
import { useRouter } from "next/router";
import { Link as LinkIcon, Plus, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "@/lib/AuthContext";
import { createMeeting, joinMeeting, parseRoomId } from "@/lib/meet/api";
import { saveMeetSession } from "@/lib/meet/socketClient";

export default function MeetHome() {
  const { user, handlegooglesignin } = useUser();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [requirePasscode, setRequirePasscode] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joinInput, setJoinInput] = useState("");
  const [passcode, setPasscode] = useState("");
  const [needsPasscode, setNeedsPasscode] = useState(false);
  const [joining, setJoining] = useState(false);

  const handleCreate = async () => {
    if (!user) {
      await handlegooglesignin();
      return;
    }
    setCreating(true);
    try {
      const created = await createMeeting(user.email, title, requirePasscode);
      const reconnectKey = `rk-${created.roomId}-${user._id}-${Date.now()}`;
      saveMeetSession({
        roomId: created.roomId,
        token: "",
        passcode: created.passcode,
        reconnectKey,
      });
      toast.success("Meeting created");
      router.push(`/meeting/${created.roomId}?create=1`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not create meeting");
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (withPasscode?: string) => {
    if (!user) {
      await handlegooglesignin();
      return;
    }
    const roomId = parseRoomId(joinInput);
    if (!roomId || roomId.length !== 9) {
      toast.error("Enter a valid meeting code or link (9-character code)");
      return;
    }
    setJoining(true);
    try {
      const info = await joinMeeting(roomId, user.email, withPasscode ?? passcode);
      const reconnectKey = `rk-${roomId}-${user._id}-${Date.now()}`;
      saveMeetSession({
        roomId,
        token: info.token,
        passcode: info.passcodeRequired ? passcode : "",
        reconnectKey,
      });
      router.push(`/meeting/${roomId}`);
    } catch (err: any) {
      const status = err?.response?.status;
      const message = err?.response?.data?.message || "Could not join meeting";
      if (status === 403) {
        setNeedsPasscode(true);
        toast.error(message);
      } else if (status === 423) {
        toast.error("This meeting is locked by the host.");
      } else if (status === 410) {
        toast.error("This meeting has ended.");
      } else if (status === 429) {
        toast.error(message);
      } else if (status === 404) {
        toast.error("Meeting not found.");
      } else {
        toast.error(message);
      }
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <VideoMark />
          </span>
          YourTube Meet
        </div>
        {user ? (
          <span className="text-sm text-slate-400">
            Signed in as <span className="font-medium text-white">{user.name}</span>
          </span>
        ) : (
          <Button onClick={handlegooglesignin}>Sign in to join</Button>
        )}
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-10 p-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold">
            Secure video calls for everyone
          </h1>
          <p className="mt-2 text-slate-400">
            Create a meeting, share the link, and talk face to face.
          </p>
        </div>

        <div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-slate-900 p-6">
            <div className="mb-4 flex items-center gap-2 font-semibold">
              <Plus className="h-5 w-5 text-blue-400" />
              Start a new meeting
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="mtitle" className="text-slate-300">
                  Meeting title (optional)
                </Label>
                <Input
                  id="mtitle"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Team sync"
                  className="mt-1 bg-white/10 text-white placeholder:text-slate-500"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={requirePasscode}
                  onChange={(e) => setRequirePasscode(e.target.checked)}
                  className="h-4 w-4 accent-blue-600"
                />
                Require a passcode to join
              </label>
              <Button
                className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                disabled={creating}
                onClick={handleCreate}
              >
                <Sparkles className="h-4 w-4" />
                {creating ? "Creating…" : "Create instant meeting"}
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900 p-6">
            <div className="mb-4 flex items-center gap-2 font-semibold">
              <LinkIcon className="h-5 w-5 text-blue-400" />
              Join a meeting
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="joinlink" className="text-slate-300">
                  Code or link
                </Label>
                <Input
                  id="joinlink"
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleJoin();
                  }}
                  placeholder="ABC12DEFG or /meeting/ABC12DEFG"
                  className="mt-1 font-mono tracking-widest bg-white/10 text-white placeholder:text-slate-500"
                />
              </div>
              {needsPasscode && (
                <div>
                  <Label htmlFor="mcode" className="text-slate-300">
                    Passcode
                  </Label>
                  <Input
                    id="mcode"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="6-digit passcode"
                    className="mt-1 bg-white/10 text-white placeholder:text-slate-500"
                  />
                </div>
              )}
              <Button
                className="w-full gap-2"
                variant="secondary"
                disabled={joining || !joinInput.trim()}
                onClick={() => handleJoin(needsPasscode ? passcode : undefined)}
              >
                <Users className="h-4 w-4" />
                {joining ? "Joining…" : "Join meeting"}
              </Button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function VideoMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
      <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
    </svg>
  );
}
