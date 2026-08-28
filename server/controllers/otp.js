import crypto from "crypto";
import jwt from "jsonwebtoken";
import OTP from "../Modals/otp.js";
import users from "../Modals/Auth.js";
import { sendOtpEmail } from "../services/email.js";

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

export const sendOtp = async (req, res) => {
  const { email } = req.body || {};
  if (!email || typeof email !== "string") {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const exists = await users.findOne({ email: email.trim().toLowerCase() });
    if (!exists) {
      return res.status(200).json({ message: "If the account exists, an OTP has been sent." });
    }

    const existing = await OTP.findOne({
      email: email.trim().toLowerCase(),
      purpose: "login",
    });

    if (existing) {
      const elapsed = (Date.now() - new Date(existing.createdAt).getTime()) / 1000;
      if (elapsed < RESEND_COOLDOWN_SECONDS) {
        const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed);
        return res.status(429).json({ message: `Please wait ${wait}s before requesting another OTP.` });
      }
      await OTP.deleteOne({ _id: existing._id });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await OTP.create({
      email: email.trim().toLowerCase(),
      hash: hashCode(code),
      purpose: "login",
      maxAttempts: MAX_ATTEMPTS,
      expiresAt,
    });

    const sent = await sendOtpEmail(email.trim().toLowerCase(), code, OTP_TTL_MINUTES);
    if (!sent) {
      await OTP.deleteOne({ email: email.trim().toLowerCase(), purpose: "login" });
      return res.status(500).json({ message: "Failed to send OTP email." });
    }

    return res.status(200).json({ message: "OTP sent successfully." });
  } catch (error) {
    console.error("sendOtp error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const verifyOtp = async (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) {
    return res.status(400).json({ message: "Email and code are required" });
  }

  try {
    const record = await OTP.findOne({
      email: email.trim().toLowerCase(),
      purpose: "login",
    });

    if (!record) {
      return res.status(400).json({ message: "Invalid or expired OTP." });
    }

    if (new Date(record.expiresAt).getTime() < Date.now()) {
      await OTP.deleteOne({ _id: record._id });
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
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
        return res.status(429).json({
          message: "Too many incorrect attempts. Please request a new OTP.",
        });
      }
      await record.save();
      const remaining = record.maxAttempts - record.attempts;
      return res.status(400).json({
        message: `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
      });
    }

    await OTP.deleteOne({ _id: record._id });

    const user = await users.findOne({ email: email.trim().toLowerCase() });
    const token = jwt.sign(
      { id: user?._id, email: email.trim().toLowerCase(), verified: true },
      process.env.JWT_SECRET || "yourtube_secret",
      { expiresIn: "7d" }
    );

    return res.status(200).json({ message: "OTP verified successfully.", token, userId: user?._id });
  } catch (error) {
    console.error("verifyOtp error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
