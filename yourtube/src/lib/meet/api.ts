import axiosInstance from "@/lib/axiosinstance";
import type { JoinInfo } from "./types";

export async function createMeeting(
  email: string,
  title?: string,
  requirePasscode?: boolean
) {
  const { data } = await axiosInstance.post("/meet/create", {
    email,
    title: title || "Video Meeting",
    requirePasscode: Boolean(requirePasscode),
  });
  return data as {
    roomId: string;
    joinUrl: string;
    passcode: string;
    title: string;
    startedAt: string;
  };
}

export async function joinMeeting(roomId: string, email: string, passcode = "") {
  const { data } = await axiosInstance.post("/meet/join", {
    roomId,
    email,
    passcode,
  });
  return data as JoinInfo;
}

export async function uploadChatFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await axiosInstance.post("/meet/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data as { url: string; name: string; size: number; type: string };
}

export async function uploadRecording(blob: Blob, roomId: string) {
  const form = new FormData();
  form.append("file", blob, `meeting-${roomId}-${Date.now()}.webm`);
  const { data } = await axiosInstance.post("/meet/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data as { url: string; name: string; size: number; type: string };
}

export function getMeetLink(roomId: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/meeting/${roomId}`;
}

export function parseRoomId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{9}/i);
  if (match) return match[0].toUpperCase();
  return trimmed.toUpperCase();
}

export function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
}

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
