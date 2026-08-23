export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : "http://localhost:5000");

export const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export type Participant = {
  socketId: string;
  id: string;
  email: string;
  name: string;
  image: string;
  micOn: boolean;
  camOn: boolean;
  raisedHand: boolean;
  speaking: boolean;
  isHost: boolean;
  isCohost: boolean;
  quality: "excellent" | "good" | "poor";
  presenting: boolean;
  joinedAt: number;
  reconnecting?: boolean;
};

export type ChatMessage = {
  id: string;
  type: "text" | "file";
  text?: string;
  url?: string;
  name?: string;
  size?: number;
  fileType?: string;
  sender: { id: string; name: string; image: string };
  ts: number;
};

export type MeetingPermissions = {
  canShareScreen: boolean;
  canChat: boolean;
};

export type MeetingUser = {
  id: string;
  email: string;
  name: string;
  image: string;
};

export type JoinInfo = {
  roomId: string;
  token: string;
  title: string;
  hostId: string;
  hostName: string;
  locked: boolean;
  passcodeRequired: boolean;
  startedAt: string;
  user: MeetingUser;
};
