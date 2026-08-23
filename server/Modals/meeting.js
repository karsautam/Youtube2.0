import mongoose from "mongoose";

const meetingSchema = mongoose.Schema(
  {
    roomId: { type: String, required: true, unique: true, index: true },
    hostId: { type: String, required: true },
    hostName: { type: String, default: "" },
    title: { type: String, default: "Video Meeting" },
    passcode: { type: String, default: "" },
    locked: { type: Boolean, default: false },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Meeting", meetingSchema);
