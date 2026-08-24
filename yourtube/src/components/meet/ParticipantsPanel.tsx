import { Mic, MicOff, Video, VideoOff, X, MoreVertical, Shield, ShieldOff, Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Participant } from "@/lib/meet/types";

type Props = {
  participants: Participant[];
  self: Participant | null;
  isHost: boolean;
  isCohost: boolean;
  hostSetMic: (targetId: string, on: boolean) => void;
  hostRemove: (targetId: string) => void;
  hostToggleCohost: (userId: string, isCohost: boolean) => void;
  onClose: () => void;
};

export default function ParticipantsPanel({
  participants,
  self,
  isHost,
  isCohost,
  hostSetMic,
  hostRemove,
  hostToggleCohost,
  onClose,
}: Props) {
  const canModerate = isHost || isCohost;

  return (
    <aside className="flex h-full w-80 max-w-[85vw] flex-col border-l border-white/10 bg-slate-900 text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="font-semibold">Participants ({participants.length})</h2>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-background/10">
          <X className="h-5 w-5" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {participants.map((p) => {
          const isMe = self?.socketId === p.socketId;
          const showActions = canModerate && !isMe;
          return (
            <div
              key={p.socketId}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-background/5",
                p.speaking && !isMe && "bg-background/10"
              )}
            >
              <Avatar className="h-9 w-9">
                <AvatarImage src={p.image} />
                <AvatarFallback>{p.name?.[0] || "?"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                  {p.raisedHand && (
                    <Hand className="h-3.5 w-3.5 shrink-0 fill-yellow-400 text-yellow-400" />
                  )}
                  <span className="truncate">{p.name}</span>
                  {isMe && <span className="text-xs text-slate-400">(You)</span>}
                </p>
                <p className="flex items-center gap-2 text-xs text-slate-400">
                  {(p.isHost || p.isCohost) && (
                    <span className="rounded bg-amber-500 px-1 text-[10px] font-bold text-foreground">
                      {p.isHost ? "HOST" : "CO-HOST"}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    {p.micOn ? (
                      <Mic className="h-3 w-3" />
                    ) : (
                      <MicOff className="h-3 w-3 text-red-400" />
                    )}
                    {p.camOn ? (
                      <Video className="h-3 w-3" />
                    ) : (
                      <VideoOff className="h-3 w-3 text-red-400" />
                    )}
                  </span>
                  {p.presenting && (
                    <span className="text-blue-400">presenting</span>
                  )}
                </p>
              </div>
              {showActions && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-background/10"
                    title={p.micOn ? "Mute" : "Unmute"}
                    onClick={() => hostSetMic(p.socketId, !p.micOn)}
                  >
                    {p.micOn ? (
                      <Mic className="h-4 w-4" />
                    ) : (
                      <MicOff className="h-4 w-4 text-red-400" />
                    )}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-white hover:bg-background/10"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {isHost && (
                        <>
                          <DropdownMenuItem
                            onClick={() => hostToggleCohost(p.id, !p.isCohost)}
                          >
                            {p.isCohost ? (
                              <ShieldOff className="mr-2 h-4 w-4" />
                            ) : (
                              <Shield className="mr-2 h-4 w-4" />
                            )}
                            {p.isCohost ? "Remove co-host" : "Make co-host"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem
                        className="text-red-500"
                        onClick={() => hostRemove(p.socketId)}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Remove from meeting
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
