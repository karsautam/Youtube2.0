import mongoose from "mongoose";

const channelFollowSchema = mongoose.Schema(
  {
    subscriber: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
  },
  { timestamps: true }
);

channelFollowSchema.index({ subscriber: 1, channel: 1 }, { unique: true });

export default mongoose.model("channelfollow", channelFollowSchema);
