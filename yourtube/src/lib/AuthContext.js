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
import { useEffect, useContext } from "react";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [pendingOtp, setPendingOtp] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [otpDevCode, setOtpDevCode] = useState("");
  const clearAuthError = () => setAuthError(null);

  const login = (userdata) => {
    setUser(userdata);
    setPendingOtp(false);
    localStorage.setItem("user", JSON.stringify(userdata));
  };
  const logout = async () => {
    setUser(null);
    setPendingOtp(false);
    localStorage.removeItem("user");
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error during sign out:", error);
    }
  };

  const syncBackendUser = async (firebaseuser) => {
    const payload = {
      email: firebaseuser.email,
      name: firebaseuser.displayName,
      image: firebaseuser.photoURL || "https://github.com/shadcn.png",
      deviceId: getDeviceId(),
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
      setAuthError(String(error?.code || error?.message || error));
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
          console.error(error);
          logout();
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
