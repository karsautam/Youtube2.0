import { useRouter } from "next/router";
import { Maximize2, PhoneOff, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useMeetingContext } from "@/lib/meet/MeetingContext";

type Props = {
  onRestore: () => void;
  onLeave: () => void;
};

export default function FloatingMeeting({ onRestore, onLeave }: Props) {
  const router = useRouter();
  const { activeMeeting, liveMedia } = useMeetingContext();
  if (!activeMeeting) return null;

  const participants = liveMedia.participants;
  const selfSocketId = liveMedia.selfSocketId;

  return (
    <div className="fixed bottom-20 right-4 z-50 w-72 overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl lg:bottom-6 lg:right-6">
      <div className="flex items-center gap-2 border-b border-white/10 bg-slate-900 px-3 py-2">
        <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-600">
          <Users className="h-3.5 w-3.5 text-white" />
        </span>
        <span className="text-sm font-medium text-white">Meeting</span>
        <span className="ml-auto rounded-full bg-background/10 px-2 py-0.5 text-[10px] font-mono tracking-widest text-slate-300">
          {activeMeeting.roomId}
        </span>
      </div>

      <div className="grid max-h-56 grid-cols-2 gap-1 overflow-y-auto bg-slate-950 p-1.5">
        {participants
          .filter((p) => !p.reconnecting)
          .map((p) => {
            const isSelf = p.socketId === selfSocketId;
            const stream = isSelf
              ? liveMedia.localStream
              : liveMedia.participantStreams[p.socketId] ?? null;
            return (
              <Tile
                key={p.socketId}
                name={p.name}
                image={p.image}
                camOn={p.camOn}
                micOn={p.micOn}
                stream={stream}
                isSelf={isSelf}
                speaking={p.speaking}
              />
            );
          })}
      </div>

      <div className="flex items-center gap-2 border-t border-white/10 bg-slate-900 px-3 py-2">
        {liveMedia.micOn ? <MicDot on /> : <MicDot on={false} />}
        <Button
          size="sm"
          variant="ghost"
          onClick={onRestore}
          className="ml-auto gap-1.5 rounded-full bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-600"
        >
          <Maximize2 className="h-3.5 w-3.5" /> Return
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onLeave}
          className="gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-600"
        >
          <PhoneOff className="h-3.5 w-3.5" /> Leave
        </Button>
      </div>
    </div>
  );
}

function Tile({
  name,
  image,
  camOn,
  micOn,
  stream,
  isSelf,
  speaking,
}: {
  name: string;
  image: string;
  camOn: boolean;
  micOn: boolean;
  stream: MediaStream | null;
  isSelf?: boolean;
  speaking?: boolean;
}) {
  const showVideo = camOn && stream && stream.getVideoTracks().length > 0;
  return (
    <div
      className={cn(
        "relative aspect-video overflow-hidden rounded-lg bg-slate-800",
        speaking && "ring-2 ring-emerald-500"
      )}
    >
      {showVideo ? (
        <video
          autoPlay
          playsInline
          muted={isSelf}
          ref={(el) => {
            if (el && stream && el.srcObject !== stream) el.srcObject = stream;
          }}
          className={cn("h-full w-full object-cover", isSelf && "-scale-x-100")}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Avatar className="h-8 w-8">
            <AvatarImage src={image} alt={name} />
            <AvatarFallback className="bg-slate-700 text-xs">
              {name?.charAt(0)?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/70 to-transparent px-1 py-0.5">
        <span className="truncate text-[9px] font-medium text-white">{name}</span>
        {isSelf ? (
          <span className="ml-auto rounded bg-blue-600/80 px-1 text-[8px] text-white">You</span>
        ) : null}
      </div>
    </div>
  );
}

function MicDot({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "h-2.5 w-2.5 rounded-full",
        on ? "bg-emerald-500" : "bg-red-500"
      )}
      title={on ? "Mic on" : "Mic muted"}
    />
  );
}
