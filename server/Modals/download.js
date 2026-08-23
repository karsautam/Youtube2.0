import mongoose from "mongoose";

const downloadSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "videofiles",
      required: true,
    },
    plan: {
      type: String,
      enum: ["free", "bronze", "silver", "gold"],
      default: "free",
    },
    status: {
      type: String,
      enum: ["completed", "failed"],
      default: "completed",
    },
    fileSizeBytes: { type: Number, default: 0 },
    fileName: { type: String },
    quality: { type: String, default: "original" },
    selectedPath: { type: String },
    ipAddress: { type: String },
    device: { type: String },
    browser: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("download", downloadSchema);
