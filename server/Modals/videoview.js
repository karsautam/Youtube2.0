import mongoose from "mongoose";
const videoviewschema = mongoose.Schema(
  {
    videoid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "videofiles",
      required: true,
    },
    viewerKey: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);
videoviewschema.index({ videoid: 1, viewerKey: 1 }, { unique: true });

export default mongoose.model("videoview", videoviewschema);
