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
  const location = await ipToLocation(ip);
  return { browser, os, deviceLabel, ip, location };
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

    // Any OTHER distinct device actively used on this account?
    const otherActive = await usersession
      .find({
        user: existingUser._id,
        deviceId: { $ne: deviceId },
        lastSeen: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
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

      const sent = await sendNewDeviceOtpEmail(normalized, code, device, OTP_TTL_MINUTES);
      if (!sent) {
        await OTP.deleteOne({ email: normalized, purpose: "device-login", deviceId });
        return res.status(500).json({ message: "Failed to send verification email." });
      }

      return res.status(200).json({
        needOtp: true,
        email: normalized,
        message: "This account is active on another device. Check your email for a verification code.",
      });
    }

    // Trusted device (known) or first device for this account: allow login
    // and record/refresh the session.
    if (known) {
      known.lastSeen = new Date();
      known.deviceLabel = device.deviceLabel;
      known.browser = device.browser;
      known.os = device.os;
      known.ip = device.ip;
      if (device.location) known.location = device.location;
      await known.save();
    } else {
      await usersession.create({
        user: existingUser._id,
        deviceId,
        deviceLabel: device.deviceLabel,
        browser: device.browser,
        os: device.os,
        ip: device.ip,
        location: device.location,
      });
    }

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

    const sent = await sendNewDeviceOtpEmail(normalized, code, device, OTP_TTL_MINUTES);
    if (!sent) {
      await OTP.deleteOne({ email: normalized, purpose: "device-login", deviceId });
      return res.status(500).json({ message: "Failed to send verification email." });
    }
    return res.status(200).json({ message: "Verification code sent." });
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
    const device = await buildDeviceInfo(req);
    const known = await usersession.findOne({ user: user._id, deviceId });
    if (known) {
      known.lastSeen = new Date();
      known.deviceLabel = device.deviceLabel;
      known.browser = device.browser;
      known.os = device.os;
      known.ip = device.ip;
      if (device.location) known.location = device.location;
      await known.save();
    } else {
      await usersession.create({
        user: user._id,
        deviceId,
        deviceLabel: device.deviceLabel,
        browser: device.browser,
        os: device.os,
        ip: device.ip,
        location: device.location,
      });
    }

    return res.status(200).json({ result: user });
  } catch (error) {
    console.error("verifyDeviceLogin error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};