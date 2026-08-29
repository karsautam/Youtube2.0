import mongoose from "mongoose";
const videochema = mongoose.Schema(
  {
    videotitle: { type: String, required: true },
    filename: { type: String, required: true },
    filetype: { type: String, required: true },
    filepath: { type: String, required: true },
    thumbnail: { type: String },
    filesize: { type: String, required: true },
    videochanel: { type: String, required: true },
    Like: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    uploader: { type: String },
    qualities: [
      {
        height: { type: Number },
        filepath: { type: String },
      },
    ],
    subtitles: [
      {
        label: { type: String },
        lang: { type: String, default: "en" },
        filepath: { type: String },
      },
    ],
    requiredPlan: { type: String, default: "free" },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("videofiles", videochema);
