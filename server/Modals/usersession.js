import mongoose from "mongoose";

const userSessionSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    deviceId: { type: String, required: true },
    deviceLabel: { type: String, default: "Unknown device" },
    browser: { type: String, default: "" },
    os: { type: String, default: "" },
    ip: { type: String, default: "" },
    location: { type: String, default: "" },
    lastSeen: { type: Date, default: Date.now },
    revoked: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// One active session per (user, device). A device re-logging in keeps its
// existing session; a brand-new device creates a new one.
userSessionSchema.index({ user: 1, deviceId: 1 }, { unique: true });
userSessionSchema.index({ user: 1, lastSeen: -1 });

export default mongoose.model("usersession", userSessionSchema);