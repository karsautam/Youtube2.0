import { io, type Socket } from "socket.io-client";
import { BACKEND_URL } from "./types";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(BACKEND_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

const KEY = "yourtube_meet_session";

export type MeetSession = {
  roomId: string;
  token: string;
  passcode?: string;
  reconnectKey: string;
};

export function saveMeetSession(session: MeetSession) {
  sessionStorage.setItem(`${KEY}_${session.roomId}`, JSON.stringify(session));
}

export function getMeetSession(roomId: string): MeetSession | null {
  try {
    const raw = sessionStorage.getItem(`${KEY}_${roomId}`);
    return raw ? (JSON.parse(raw) as MeetSession) : null;
  } catch {
    return null;
  }
}

export function clearMeetSession(roomId: string) {
  sessionStorage.removeItem(`${KEY}_${roomId}`);
}
