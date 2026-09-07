import crypto from "crypto";
import users from "../Modals/Auth.js";
import usersession from "../Modals/usersession.js";
import OTP from "../Modals/otp.js";
import { sendNewDeviceOtpEmail } from "../services/email.js";
import { parseUserAgent, ipToLocation, getIpFromRequest } from "../utils/deviceInfo.js";

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;
// Only require OTP when another device has REALLY been used very recently
// (a different-origin tab or old session should NOT keep asking for a code).
const OTHER_ACTIVE_WINDOW_MS = Number(process.env.OTP_ACTIVE_WINDOW_MINUTES || 15) * 60 * 1000;

function hashCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

function generateCode() {
  return crypto.randomInt(0, 1000000).toString().padStart(OTP_LENGTH, "0");
}

async function buildDeviceInfo(req) {
  const ua = req.headers["user-agent"];
  const { browser, os, deviceLabel } = parseUserAgent(ua);
  const ip = getIpFromRequest(req);
  // Resolve location in the background so it never blocks the login response.
  const locationPromise = ipToLocation(ip);
  return { browser, os, deviceLabel, ip, locationPromise };
}

// Awaits the background location lookup (used only when preparing the OTP email).
async function resolveLocation(device) {
  if (device?.location) return device.location;
  try {
    return (await device?.locationPromise) || "";
  } catch {
    return "";
  }
}

// Send the OTP email but never block login forever: wait up to ~8s for the
// result. If the email could not be delivered (SMTP down/misconfigured), the
// code is returned so the user can still sign in instead of being stuck.
async function sendDeviceOtpEmailBounded(email, code, device) {
  try {
    const result = await Promise.race([
      sendNewDeviceOtpEmail(email, code, device, OTP_TTL_MINUTES),
      new Promise((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);
    if (result === true) return { sent: true, devCode: null };
    if (result === false) {
      console.error(`[OTP] Email send FAILED for ${email}; exposing code as fallback (SMTP not delivered).`);
      return { sent: false, devCode: code };
    }
    // Timed out — unknown if it arrived. Keep the code as a fallback too.
    console.warn(`[OTP] Email send TIMED OUT for ${email}; exposing code as fallback.`);
    return { sent: false, devCode: code };
  } catch (error) {
    console.error(`[OTP] Email send error for ${email}:`, error.message);
    return { sent: false, devCode: code };
  }
}

// Save/refresh a session immediately and update its location in the background
// once the IP lookup resolves — this keeps login fast (never blocks on ip-api).
async function saveSession(userId, deviceId, device) {
  const known = await usersession.findOne({ user: userId, deviceId });
  if (known) {
    known.lastSeen = new Date();
    known.deviceLabel = device.deviceLabel;
    known.browser = device.browser;
    known.os = device.os;
    known.ip = device.ip;
    await known.save();
    resolveLocation(device).then((loc) => {
      if (loc) {
        usersession
          .updateOne({ _id: known._id }, { $set: { location: loc } })
          .catch(() => {});
      }
    });
    return known;
  }
  const created = await usersession.create({
    user: userId,
    deviceId,
    deviceLabel: device.deviceLabel,
    browser: device.browser,
    os: device.os,
    ip: device.ip,
    location: "",
  });
  resolveLocation(device).then((loc) => {
    if (loc) {
      usersession
        .updateOne({ _id: created._id }, { $set: { location: loc } })
        .catch(() => {});
    }
  });
  return created;
}

// Core login: creates the backend user if needed, then decides whether this
// device is trusted. If the account is already active on a DIFFERENT device,
// it emails an OTP and returns needOtp instead of granting access.
export const login = async (req, res) => {
  const { email, name, image, deviceId } = req.body;
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) {
    return res.status(400).json({ message: "Email is required" });
  }
  if (!deviceId) {
    return res.status(400).json({ message: "deviceId is required" });
  }

  try {
    let existingUser = await users.findOne({ email: normalized });
    if (!existingUser) {
      existingUser = await users.create({ email: normalized, name, image, location: "" });
    }

    const device = await buildDeviceInfo(req);

    // Is this device already trusted for this account?
    const known = await usersession.findOne({ user: existingUser._id, deviceId });

    // Any OTHER distinct device VERY RECENTLY active on this account?
    const otherActive = await usersession
      .find({
        user: existingUser._id,
        deviceId: { $ne: deviceId },
        lastSeen: { $gte: new Date(Date.now() - OTHER_ACTIVE_WINDOW_MS) },
      })
      .countDocuments();

    if (!known && otherActive > 0) {
      // Second device logging into an already-active account => require OTP.
      const existing = await OTP.findOne({
        email: normalized,
        purpose: "device-login",
        deviceId,
      });
      if (existing) {
        const elapsed = (Date.now() - new Date(existing.createdAt).getTime()) / 1000;
        if (elapsed < RESEND_COOLDOWN_SECONDS) {
          const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed);
          return res.status(429).json({
            message: `Please wait ${wait}s before requesting another OTP.`,
            needOtp: true,
            email: normalized,
          });
        }
        await OTP.deleteOne({ _id: existing._id });
      }

      const code = generateCode();
      const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
      await OTP.create({
        email: normalized,
        hash: hashCode(code),
        purpose: "device-login",
        deviceId,
        maxAttempts: MAX_ATTEMPTS,
        expiresAt,
      });

      await resolveLocation(device);
      const { sent, devCode } = await sendDeviceOtpEmailBounded(normalized, code, device);

      return res.status(200).json({
        needOtp: true,
        email: normalized,
        devCode,
        // Keep the OTP alive even if the email failed so the fallback code works.
        message: sent
          ? "This account was used on another device recently. Check your email for a verification code."
          : "We couldn't send a verification email, so we've shown the code below. Enter it to finish signing in.",
      });
    }

    // Trusted device (known) or first device for this account: allow login
    // and record/refresh the session.
    await saveSession(existingUser._id, deviceId, device);

    return res.status(200).json({ result: existingUser });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const resendDeviceOtp = async (req, res) => {
  const { email, deviceId } = req.body || {};
  if (!email || !deviceId) {
    return res.status(400).json({ message: "Email and deviceId are required" });
  }
  const normalized = String(email).trim().toLowerCase();

  try {
    const existing = await OTP.findOne({
      email: normalized,
      purpose: "device-login",
      deviceId,
    });
    if (existing) {
      const elapsed = (Date.now() - new Date(existing.createdAt).getTime()) / 1000;
      if (elapsed < RESEND_COOLDOWN_SECONDS) {
        const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed);
        return res.status(429).json({ message: `Please wait ${wait}s before resending.` });
      }
      await OTP.deleteOne({ _id: existing._id });
    }

    const device = await buildDeviceInfo(req);
    const code = generateCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    await OTP.create({
      email: normalized,
      hash: hashCode(code),
      purpose: "device-login",
      deviceId,
      maxAttempts: MAX_ATTEMPTS,
      expiresAt,
    });

    await resolveLocation(device);
    const { sent, devCode } = await sendDeviceOtpEmailBounded(normalized, code, device);
    return res.status(200).json({
      message: sent ? "Verification code sent." : "Email failed — code shown below.",
      devCode,
    });
  } catch (error) {
    console.error("resendDeviceOtp error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const verifyDeviceLogin = async (req, res) => {
  const { email, code, deviceId, name, image } = req.body || {};
  if (!email || !code || !deviceId) {
    return res.status(400).json({ message: "Email, code and deviceId are required" });
  }
  const normalized = String(email).trim().toLowerCase();

  try {
    const record = await OTP.findOne({
      email: normalized,
      purpose: "device-login",
      deviceId,
    });
    if (!record) {
      return res.status(400).json({ message: "Invalid or expired code." });
    }
    if (new Date(record.expiresAt).getTime() < Date.now()) {
      await OTP.deleteOne({ _id: record._id });
      return res.status(400).json({ message: "Code expired. Please request a new one." });
    }

    const supplied = hashCode(String(code).trim());
    const valid = crypto.timingSafeEqual(
      Buffer.from(supplied, "hex"),
      Buffer.from(record.hash, "hex")
    );
    if (!valid) {
      record.attempts += 1;
      if (record.attempts >= record.maxAttempts) {
        await OTP.deleteOne({ _id: record._id });
        return res.status(429).json({ message: "Too many incorrect attempts. Request a new code." });
      }
      await record.save();
      const remaining = record.maxAttempts - record.attempts;
      return res.status(400).json({
        message: `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
      });
    }

    await OTP.deleteOne({ _id: record._id });

    const user = await users.findOne({ email: normalized });
    if (!user) {
      return res.status(404).json({ message: "Account not found" });
    }

    // Now that the code verified, register this device as a trusted session.
    await saveSession(user._id, deviceId, device);

    return res.status(200).json({ result: user });
  } catch (error) {
    console.error("verifyDeviceLogin error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};