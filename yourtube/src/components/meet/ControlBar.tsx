import {
  CircleDot,
  Clapperboard,
  Hand,
  MessagesSquare,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  SwitchCamera,
  Users,
  UserPlus,
  Video,
  VideoOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/meet/api";

type Props = {
  micOn: boolean;
  camOn: boolean;
  canSwitchCamera: boolean;
  presenting: boolean;
  canShareScreen: boolean;
  canWatch: boolean;
  watchActive: boolean;
  chatOpen: boolean;
  chatUnread: number;
  participantsOpen: boolean;
  handRaised: boolean;
  recording: boolean;
  canRecord: boolean;
  locked: boolean;
  isHost: boolean;
  callDuration: number;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onSwitchCamera: () => void;
  onToggleScreenShare: () => void;
  onToggleWatch: () => void;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onToggleInvite: () => void;
  onToggleHand: () => void;
  onToggleRecording: () => void;
  onToggleLock: () => void;
  onLeave: () => void;
};

function IconButton({
  onClick,
  active,
  danger,
  accent,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  accent?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      title={title}
      className={cn(
        "h-9 w-9 shrink-0 rounded-full bg-background/10 text-white hover:bg-background/20 hover:text-white sm:h-12 sm:w-12 [&_svg]:h-4 [&_svg]:w-4 sm:[&_svg]:h-5 sm:[&_svg]:w-5",
        active && "bg-blue-600 hover:bg-blue-600",
        accent && "bg-blue-600/80 hover:bg-blue-600",
        danger && "bg-red-600 hover:bg-red-700"
      )}
    >
      {children}
    </Button>
  );
}

export default function ControlBar(props: Props) {
  return (
    <div className="pointer-events-auto flex w-full max-w-full flex-wrap items-center justify-center gap-1 rounded-2xl bg-black/60 px-1.5 py-1.5 backdrop-blur sm:w-auto sm:max-w-none sm:gap-2 sm:px-4 sm:py-2">
      <div className="flex items-center gap-1 sm:gap-2">
        <IconButton
          onClick={props.onToggleMic}
          active={props.micOn}
          title={props.micOn ? "Mute microphone" : "Unmute microphone"}
        >
          {props.micOn ? (
            <Mic className="h-5 w-5" />
          ) : (
            <MicOff className="h-5 w-5" />
          )}
        </IconButton>
        <IconButton
          onClick={props.onToggleCam}
          active={props.camOn}
          title={props.camOn ? "Turn camera off" : "Turn camera on"}
        >
          {props.camOn ? (
            <Video className="h-5 w-5" />
          ) : (
            <VideoOff className="h-5 w-5" />
          )}
        </IconButton>
        {props.canSwitchCamera && (
          <IconButton
            onClick={props.onSwitchCamera}
            title="Switch camera"
          >
            <SwitchCamera className="h-5 w-5" />
          </IconButton>
        )}
      </div>

      <div className="mx-1 hidden h-8 w-px bg-background/20 sm:block" />

      <div className="flex items-center gap-1 sm:gap-2">
        <IconButton
          onClick={props.onToggleScreenShare}
          active={props.presenting}
          title="Share screen"
        >
          <MonitorUp className="h-5 w-5" />
        </IconButton>
        {props.canWatch && (
          <IconButton
            onClick={props.onToggleWatch}
            active={props.watchActive}
            title={
              props.watchActive
                ? "Watch together (started)"
                : "Watch video together"
            }
          >
            <Clapperboard className="h-5 w-5" />
          </IconButton>
        )}
        {props.canRecord && (
          <IconButton
            onClick={props.onToggleRecording}
            active={props.recording}
            danger={props.recording}
            title={props.recording ? "Stop recording" : "Record meeting"}
          >
            <CircleDot className="h-5 w-5" />
          </IconButton>
        )}
        <IconButton
          onClick={props.onToggleHand}
          active={props.handRaised}
          title={props.handRaised ? "Lower hand" : "Raise hand"}
        >
          <Hand className="h-5 w-5" />
        </IconButton>
      </div>

      <div className="mx-1 hidden h-8 w-px bg-background/20 sm:block" />

      <div className="flex items-center gap-1 sm:gap-2">
        <IconButton
          onClick={props.onToggleChat}
          active={props.chatOpen}
          title="In-call chat"
        >
          <span className="relative">
            <MessagesSquare className="h-5 w-5" />
            {!props.chatOpen && props.chatUnread > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
                {props.chatUnread > 99 ? "99+" : props.chatUnread}
              </span>
            )}
          </span>
        </IconButton>
        <IconButton
          onClick={props.onToggleParticipants}
          active={props.participantsOpen}
          title="Participants"
        >
          <Users className="h-5 w-5" />
        </IconButton>
        <IconButton onClick={props.onToggleInvite} accent title="Invite / share meeting code">
          <UserPlus className="h-5 w-5" />
        </IconButton>
        {props.isHost && (
          <IconButton
            onClick={props.onToggleLock}
            active={props.locked}
            title={props.locked ? "Unlock meeting" : "Lock meeting"}
          >
            <LockMini locked={props.locked} />
          </IconButton>
        )}
        <IconButton
          onClick={props.onLeave}
          danger
          title="Leave meeting"
        >
          <PhoneOff className="h-5 w-5" />
        </IconButton>
      </div>

      <div className="ml-0 flex items-center gap-2 sm:ml-2">
        {props.presenting && (
          <span className="hidden items-center gap-1 rounded-full bg-blue-600 px-2 py-1 text-xs text-white sm:flex">
            <MonitorUp className="h-3 w-3" /> You are presenting
          </span>
        )}
        {props.recording && (
          <span className="flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-1 text-xs font-semibold text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-background" />
            REC
          </span>
        )}
        <span className="rounded-full bg-background/10 px-2 py-1 text-[10px] tabular-nums text-white sm:text-xs">
          {formatDuration(props.callDuration)}
        </span>
      </div>
    </div>
  );
}

function LockMini({ locked }: { locked: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {locked ? (
        <>
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </>
      ) : (
        <>
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 9.9-1" />
        </>
      )}
    </svg>
  );
}
