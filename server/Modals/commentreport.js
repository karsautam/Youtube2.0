import mongoose from "mongoose";

const reportschema = mongoose.Schema(
  {
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "comment",
      required: true,
    },
    videoid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "videofiles",
      required: true,
    },
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    reporterName: { type: String },
    reason: {
      type: String,
      enum: [
        "spam",
        "harassment",
        "offensive",
        "misinformation",
        "impersonation",
        "other",
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "reviewed", "actioned", "dismissed"],
      default: "pending",
    },
    // Moderation record fields (filled by an admin when the report is handled).
    resolution: { type: String },
    moderatedAt: { type: Date },
    commentRemoved: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// A user can report a comment at most once (dedupes duplicate reports).
reportschema.index({ comment: 1, reporter: 1 }, { unique: true });
reportschema.index({ status: 1, createdAt: -1 });

export default mongoose.model("commentreport", reportschema);