import BACKEND_URL from "./backendUrl";

export default function mediaUrl(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${BACKEND_URL}/${path}`;
}
