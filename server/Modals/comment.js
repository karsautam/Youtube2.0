import mongoose from "mongoose";
const commentschema = mongoose.Schema(
  {
    userid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    videoid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "videofiles",
      required: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "comment",
      default: null,
    },
    commentbody: { type: String },
    usercommented: { type: String },
    userimage: { type: String, default: "" },
    likes: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
      default: [],
    },
    dislikes: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
      default: [],
    },
    replyCount: { type: Number, default: 0 },
    likesCount: { type: Number, default: 0 },
    dislikesCount: { type: Number, default: 0 },
    edited: { type: Boolean, default: false },
    editedAt: { type: Date },
    commentedon: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

commentschema.index({ videoid: 1, commentedon: -1 });
commentschema.index({ videoid: 1, parentId: 1 });

export default mongoose.model("comment", commentschema);
