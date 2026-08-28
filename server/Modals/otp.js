import mongoose from "mongoose";

const otpSchema = mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  hash: { type: String, required: true },
  purpose: { type: String, default: "login" },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 5 },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
});

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("otp", otpSchema);
