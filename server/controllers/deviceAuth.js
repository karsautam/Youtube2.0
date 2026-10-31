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
// Require OTP when another device has been active within this window. Since a
// successful OTP verification revokes all older sessions, we can afford a wide
// window (30 days) — stale sessions no longer pile up.
const OTHER_ACTIVE_WINDOW_MS = Number(process.env.OTP_ACTIVE_WINDOW_MINUTES || 43200) * 60 * 1000;

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

// The location is cosmetic: never let a slow ip-api call delay the OTP email.
async function resolveLocationFast(device, ms = 400) {
  if (device?.location) return device.location;
  const location = await Promise.race([
    resolveLocation(device),
    new Promise((resolve) => setTimeout(() => resolve(""), ms)),
  ]);
  device.location = location || "";
  return device.location;
}

// Send the OTP email but never block login forever: wait up to ~20s for the
// result. Gmail SMTP can occasionally take 8-15s under load, so the old 8s
// cutoff reported a failure (and exposed the code) while the email still landed.
// If the email truly could not be delivered, the code is returned so the user
// can still sign in instead of being stuck.
async function sendDeviceOtpEmailBounded(email, code, device) {
  try {
    const result = await Promise.race([
      sendNewDeviceOtpEmail(email, code, device, OTP_TTL_MINUTES),
      new Promise((resolve) => setTimeout(() => resolve(null), 20000)),
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
  const updates = {
    lastSeen: new Date(),
    deviceLabel: device.deviceLabel,
    browser: device.browser,
    os: device.os,
    ip: device.ip,
    revoked: false,
  };

  let session = null;
  try {
    session = await usersession.findOneAndUpdate(
      { user: userId, deviceId },
      { $set: updates, $setOnInsert: { location: "" } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    // Two concurrent logins can race on the unique (user, deviceId) index.
    // If the other request won the insert, just update the existing row.
    if (error?.code === 11000) {
      session = await usersession.findOneAndUpdate(
        { user: userId, deviceId },
        { $set: updates },
        { new: true }
      );
    } else {
      throw error;
    }
  }

  if (session) {
    resolveLocation(device).then((loc) => {
      if (loc) {
        usersession
          .updateOne({ _id: session._id }, { $set: { location: loc } })
          .catch(() => {});
      }
    });
  }
  return session;
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
    // Atomic find-or-create so two concurrent logins (e.g. signInWithPopup and
    // onAuthStateChanged) cannot create two user documents for one email.
    let existingUser = await users.findOneAndUpdate(
      { email: normalized },
      { $setOnInsert: { email: normalized, name, image, location: "" } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const device = await buildDeviceInfo(req);

    // Is this device already trusted for this account?
    const known = await usersession.findOne({ user: existingUser._id, deviceId });

    // Any OTHER distinct device VERY RECENTLY active on this account?
    const otherActive = await usersession
      .find({
        user: existingUser._id,
        deviceId: { $ne: deviceId },
        lastSeen: { $gte: new Date(Date.now() - OTHER_ACTIVE_WINDOW_MS) },
        revoked: { $ne: true },
      })
      .countDocuments();

    if (!known && otherActive > 0) {
      // A NEW device logging into an account that's active on another device.
      // Allow the login but also flag that this device needs OTP verification.
      const existing = await OTP.findOne({
        email: normalized,
        purpose: "device-login",
        deviceId,
      });
      if (existing) {
        const elapsed = (Date.now() - new Date(existing.createdAt).getTime()) / 1000;
        if (elapsed < RESEND_COOLDOWN_SECONDS) {
          const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed);
          return res.status(200).json({
            result: existingUser,
            needOtp: true,
            email: normalized,
            message: `Please wait ${wait}s before requesting another OTP. Check your email.`,
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

      await resolveLocationFast(device);
      const { sent, devCode } = await sendDeviceOtpEmailBounded(normalized, code, device);

      return res.status(200).json({
        result: existingUser,
        needOtp: true,
        email: normalized,
        devCode,
        message: sent
          ? "Signed in on this device. We emailed a verification code — enter it to confirm and sign out other devices."
          : "Signed in on this device, but the email failed. Use the code shown below.",
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

// Lets the frontend check whether the current device session is still valid.
// After OTP verification on a new device, older sessions are revoked -> the
// first device polls this and signs itself out.
// Sign the current device out: revoke its session so it no longer counts as an
// "other active device" (which would otherwise force OTP on the next login).
export const logout = async (req, res) => {
  const userId = req.body?.userId || req.query?.userId;
  const deviceId = req.body?.deviceId || req.query?.deviceId;
  if (!userId || !deviceId) {
    return res.status(400).json({ message: "userId and deviceId are required" });
  }
  try {
    await usersession.updateOne(
      { user: userId, deviceId, revoked: { $ne: true } },
      { $set: { revoked: true, lastSeen: new Date() } }
    );
    return res.status(200).json({ message: "Signed out" });
  } catch (error) {
    console.error("logout error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const checkSessionStatus = async (req, res) => {
  const userId = req.query?.userId || req.body?.userId;
  const deviceId = req.query?.deviceId || req.body?.deviceId;
  if (!userId || !deviceId) {
    return res.status(400).json({ message: "userId and deviceId are required" });
  }
  try {
    const session = await usersession.findOne({ user: userId, deviceId });
    const revoked = !session || session.revoked === true;
    return res.status(200).json({ revoked });
  } catch (error) {
    console.error("checkSessionStatus error:", error);
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

    await resolveLocationFast(device);
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

    // Code verified. Register this device as the trusted/active session and
    // REVOKE every other device so the previous device gets signed out.
    const device = await buildDeviceInfo(req);
    await saveSession(user._id, deviceId, device);
    await usersession.updateMany(
      { user: user._id, deviceId: { $ne: deviceId }, revoked: { $ne: true } },
      { $set: { revoked: true } }
    );

    return res.status(200).json({
      result: user,
      message: "Device verified. Other devices have been signed out.",
    });
  } catch (error) {
    console.error("verifyDeviceLogin error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};