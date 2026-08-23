import mongoose from "mongoose";

const watchprogresschema = mongoose.Schema(
  {
    viewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    videoid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "videofiles",
      required: true,
    },
    position: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    lastupdatedon: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

watchprogresschema.index({ viewer: 1, videoid: 1 }, { unique: true });

export default mongoose.model("watchprogress", watchprogresschema);
