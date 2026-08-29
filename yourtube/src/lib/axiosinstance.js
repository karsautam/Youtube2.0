import axios from "axios";
const axiosInstance = axios.create({
  baseURL:
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    (typeof window !== "undefined"
      ? window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? "http://localhost:5000"
        : window.location.hostname.endsWith("vercel.app")
          ? "https://yourtube-backend-ewzs.onrender.com"
          : `${window.location.protocol}//${window.location.hostname}:5000`
      : "http://localhost:5000"),
});
export default axiosInstance;
