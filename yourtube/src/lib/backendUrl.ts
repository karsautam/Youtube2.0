const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  (typeof window !== "undefined"
    ? window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "http://localhost:5000"
      : "https://yourtube-backend-ewzs.onrender.com"
    : "http://localhost:5000");

export default BACKEND_URL;
