import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from "firebase/auth";
import { useState } from "react";
import { createContext } from "react";
import { provider, auth } from "./firebase";
import axiosInstance from "./axiosinstance";
import { getDeviceId } from "./deviceId";
import OtpVerifyDialog from "@/components/OtpVerifyDialog";
import { useEffect, useContext, useCallback, useRef } from "react";

const UserContext = createContext();

function describeAuthError(error) {
  const code = error?.code || "";
  const origin =
    typeof window !== "undefined" ? window.location.origin : "this address";
  switch (code) {
    case "auth/unauthorized-domain":
      return `Google sign-in isn't allowed from ${origin}. Add this domain in Firebase Console → Authentication → Settings → Authorized domains, then reload. IP addresses (e.g. 192.168.x.x) can't be authorized — use a domain/tunnel (ngrok, Vercel) or localhost (Android: adb reverse tcp:3000 tcp:3000).`;
    case "auth/operation-not-allowed":
      return "Google sign-in is disabled for this Firebase project. Enable it in Firebase Console → Authentication → Sign-in method → Google.";
    case "auth/popup-blocked":
      return "Your browser blocked the Google popup. Allow popups for this site and try again.";
    case "auth/cancelled-popup-request":
      return "Another sign-in popup is already open. Finish or close it and try again.";
    case "auth/network-request-failed":
      return "Network error while contacting Google. Check your connection and try again.";
    default:
      return code || error?.message || String(error);
  }
}

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [pendingOtp, setPendingOtp] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [otpDevCode, setOtpDevCode] = useState("");
  const clearAuthError = () => setAuthError(null);
  // signInWithPopup resolves AND onAuthStateChanged fires for the same sign-in,
  // which would otherwise send two concurrent /user/login requests. That race
  // can create duplicate sessions/users and make one request 500.
  const syncInFlightRef = useRef(null);
  const lastSyncRef = useRef(null);

  const login = (userdata) => {
    setUser(userdata);
    setPendingOtp(false);
    localStorage.setItem("user", JSON.stringify(userdata));
  };
  const logout = useCallback(async () => {
    const currentUser = user;
    lastSyncRef.current = null;
    setUser(null);
    setPendingOtp(false);
    localStorage.removeItem("user");
    try {
      if (currentUser?._id) {
        axiosInstance
          .post("/user/logout", { userId: currentUser._id, deviceId: getDeviceId() })
          .catch(() => {});
      }
    } catch (error) {
      console.error("Error during sign out:", error);
    }
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error during sign out:", error);
    }
  }, [user]);

  const syncBackendUser = async (firebaseuser) => {
    const key = `${firebaseuser.uid || firebaseuser.email}:${firebaseuser.email}`;
    const inFlight = syncInFlightRef.current;
    if (inFlight && inFlight.key === key) {
      return inFlight.promise;
    }
    const last = lastSyncRef.current;
    if (last && last.key === key && Date.now() - last.at < 5000) {
      return;
    }
    const promise = (async () => {
      const providerIds = (firebaseuser.providerData || []).map(
        (p) => p.providerId
      );
      const payload = {
        email: firebaseuser.email,
        name: firebaseuser.displayName,
        image: firebaseuser.photoURL || "https://github.com/shadcn.png",
        deviceId: getDeviceId(),
        provider: providerIds.includes("google.com")
          ? "google.com"
          : providerIds[0] || "",
      };
      const response = await axiosInstance.post("/user/login", payload);
      if (response.data && response.data.needOtp) {
        // Log them in first (they land on the home page), then present the OTP
        // dialog over whatever page they're on.
        if (response.data.result) {
          login(response.data.result);
        }
        setOtpEmail(response.data.email || firebaseuser.email);
        setOtpDevCode(response.data.devCode || "");
        setPendingOtp(true);
        return;
      }
      login(response.data.result);
    })();
    syncInFlightRef.current = { key, promise };
    try {
      const result = await promise;
      lastSyncRef.current = { key, at: Date.now() };
      return result;
    } finally {
      if (syncInFlightRef.current?.promise === promise) {
        syncInFlightRef.current = null;
      }
    }
  };

  const verifyDeviceOtp = async (code) => {
    const response = await axiosInstance.post("/user/verify-device-login", {
      email: otpEmail,
      code,
      deviceId: getDeviceId(),
      name: "",
      image: "",
    });
    if (response.data && response.data.result) {
      login(response.data.result);
      return { success: true, message: response.data.message };
    }
    return { success: false };
  };

  const resendDeviceOtp = async () => {
    const response = await axiosInstance.post("/user/resend-device-otp", {
      email: otpEmail,
      deviceId: getDeviceId(),
    });
    setOtpDevCode(response.data?.devCode || "");
    return response.data;
  };

  const handlegooglesignin = async () => {
    clearAuthError();
    try {
      const result = await signInWithPopup(auth, provider);
      await syncBackendUser(result.user);
    } catch (error) {
      setAuthError(describeAuthError(error));
      if (
        error?.code === "auth/popup-blocked" ||
        error?.code === "auth/operation-not-supported-in-this-environment"
      ) {
        try {
          sessionStorage.setItem("yt_redirect_pending", "1");
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectError) {
          console.error(redirectError);
        }
      }
      console.error(error);
      throw error;
    }
  };

  const handleEmailLogin = async (email, password) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    await syncBackendUser(result.user);
  };

  const handleEmailSignup = async (name, email, password) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const displayName = name || email.split("@")[0];
    await updateProfile(result.user, { displayName });
    await syncBackendUser(result.user);
  };

  useEffect(() => {
    let active = true;
    getRedirectResult(auth)
      .then((result) => {
        if (!active) return;
        if (result && result.user) {
          sessionStorage.removeItem("yt_redirect_pending");
          return syncBackendUser(result.user);
        }
        if (sessionStorage.getItem("yt_redirect_pending")) {
          sessionStorage.removeItem("yt_redirect_pending");
          console.warn("getRedirectResult: no pending sign-in found after redirect");
          setAuthError("redirect-came-back-empty");
        }
      })
      .catch((error) => {
        console.error("getRedirectResult error:", error?.code, error?.message);
        setAuthError(String(error?.code || error?.message || error));
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const unsubcribe = onAuthStateChanged(auth, async (firebaseuser) => {
      if (firebaseuser) {
        sessionStorage.removeItem("yt_redirect_pending");
        try {
          await syncBackendUser(firebaseuser);
        } catch (error) {
          // Keep the Firebase session so a retry/refresh can sync again —
          // force-signing-out here would also kill a login that just succeeded
          // through signInWithPopup.
          console.error("Backend login sync failed:", error);
          setAuthError(
            error?.response?.data?.message ||
              "Could not reach the server. Please try signing in again."
          );
        }
      }
    });
    return () => unsubcribe();
  }, []);

  // While signed in, poll session status. When a NEW device verifies its OTP,
  // this device's session gets revoked -> force sign-out here.
  useEffect(() => {
    if (!user || !user._id || pendingOtp) return;
    let stopped = false;
    const check = async () => {
      try {
        const res = await axiosInstance.get("/user/session-status", {
          params: { userId: user._id, deviceId: getDeviceId() },
        });
        if (!stopped && res.data && res.data.revoked) {
          await logout();
        }
      } catch (error) {
        // transient network errors are fine; keep polling
      }
    };
    check();
    const timer = setInterval(check, 10000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pendingOtp, logout]);

  return (
    <UserContext.Provider
      value={{
        user,
        login,
        logout,
        authError,
        clearAuthError,
        pendingOtp,
        otpEmail,
        otpDevCode,
        verifyDeviceOtp,
        resendDeviceOtp,
        handlegooglesignin,
        handleEmailLogin,
        handleEmailSignup,
      }}
    >
      {children}
      <OtpVerifyDialog />
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
