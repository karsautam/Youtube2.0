const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : "http://localhost:5000");

export default BACKEND_URL;
