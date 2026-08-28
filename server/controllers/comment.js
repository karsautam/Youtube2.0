import comment from "../Modals/comment.js";
import mongoose from "mongoose";

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function decorate(items, userId) {
  const uid = userId ? String(userId) : null;
  return items.map((c) => {
    const likes = c.likes || [];
    const dislikes = c.dislikes || [];
    return {
      _id: c._id,
      userid: c.userid,
      videoid: c.videoid,
      parentId: c.parentId,
      commentbody: c.commentbody,
      usercommented: c.usercommented,
      userimage: c.userimage,
      likesCount: c.likesCount || (c.likes ? c.likes.length : 0),
      dislikesCount: c.dislikesCount || (c.dislikes ? c.dislikes.length : 0),
      replyCount: c.replyCount || 0,
      edited: c.edited,
      editedAt: c.editedAt,
      commentedon: c.commentedon,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      liked: Boolean(uid && likes.find((id) => String(id) === uid)),
      disliked: Boolean(uid && dislikes.find((id) => String(id) === uid)),
    };
  });
}

export const postcomment = async (req, res) => {
  const authUser = req.authUser;
  if (!authUser) {
    return res.status(401).json({ message: "Login required" });
  }
  const { videoid, commentbody, parentId } = req.body || {};
  if (!videoid || !commentbody || !String(commentbody).trim()) {
    return res.status(400).json({ message: "Comment is required" });
  }

  try {
    if (parentId && !isValidId(parentId)) {
      return res.status(400).json({ message: "Invalid parent comment" });
    }

    const postcomment = new comment({
      videoid,
      parentId: parentId || null,
      commentbody: String(commentbody).trim().slice(0, 10000),
      userid: authUser._id,
      usercommented: authUser.name || authUser.channelname || "Anonymous",
      userimage: authUser.image || "",
    });
    await postcomment.save();

    if (postcomment.parentId) {
      await comment.updateOne(
        { _id: postcomment.parentId },
        { $inc: { replyCount: 1 } }
      );
    }

    const [decorated] = decorate([postcomment], authUser._id);
    return res.status(200).json({ comment: true, data: decorated });
  } catch (error) {
    console.error("postcomment error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getallcomment = async (req, res) => {
  const { videoid } = req.params;
  const sort = req.query.sort === "top" ? "top" : "newest";
  const userId = req.query.userId || null;

  try {
    let docs;
    if (sort === "top") {
      docs = await comment.find({ videoid, parentId: null }).sort({ likesCount: -1, commentedon: -1 });
    } else {
      docs = await comment.find({ videoid, parentId: null }).sort({ commentedon: -1 });
    }
    return res.status(200).json(decorate(docs, userId));
  } catch (error) {
    console.error("getallcomment error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getreplies = async (req, res) => {
  const { id } = req.params;
  const userId = req.query.userId || null;
  if (!isValidId(id)) {
    return res.status(400).json({ message: "Invalid comment" });
  }
  try {
    const replies = await comment.find({ parentId: id }).sort({ commentedon: 1 });
    return res.status(200).json(decorate(replies, userId));
  } catch (error) {
    console.error("getreplies error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const togglecommentlike = async (req, res) => {
  const authUser = req.authUser;
  if (!authUser) return res.status(401).json({ message: "Login required" });
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ message: "Invalid comment" });

  try {
    const doc = await comment.findById(id);
    if (!doc) return res.status(404).json({ message: "Comment not found" });

    const uid = String(authUser._id);
    const hadLike = doc.likes.some((x) => String(x) === uid);
    const hadDislike = doc.dislikes.some((x) => String(x) === uid);

    let likes = doc.likes.filter((x) => String(x) !== uid);
    if (!hadLike) likes.push(authUser._id);
    let dislikes = hadLike ? doc.dislikes : doc.dislikes.filter((x) => String(x) !== uid);

    await comment.updateOne(
      { _id: id },
      { $set: { likes, dislikes, likesCount: likes.length, dislikesCount: dislikes.length } }
    );
    return res.status(200).json({
      comment: true,
      liked: !hadLike,
      dislikesCount: dislikes.length,
      likesCount: likes.length,
    });
  } catch (error) {
    console.error("togglecommentlike error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const togglecommentdislike = async (req, res) => {
  const authUser = req.authUser;
  if (!authUser) return res.status(401).json({ message: "Login required" });
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ message: "Invalid comment" });

  try {
    const doc = await comment.findById(id);
    if (!doc) return res.status(404).json({ message: "Comment not found" });

    const uid = String(authUser._id);
    const hadDislike = doc.dislikes.some((x) => String(x) === uid);
    const hadLike = doc.likes.some((x) => String(x) === uid);

    let dislikes = doc.dislikes.filter((x) => String(x) !== uid);
    if (!hadDislike) dislikes.push(authUser._id);
    let likes = hadDislike ? doc.likes : doc.likes.filter((x) => String(x) !== uid);

    await comment.updateOne(
      { _id: id },
      { $set: { likes, dislikes, likesCount: likes.length, dislikesCount: dislikes.length } }
    );
    return res.status(200).json({
      comment: true,
      disliked: !hadDislike,
      dislikesCount: dislikes.length,
      likesCount: likes.length,
    });
  } catch (error) {
    console.error("togglecommentdislike error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const deletecomment = async (req, res) => {
  const authUser = req.authUser;
  if (!authUser) return res.status(401).json({ message: "Login required" });
  const { id: _id } = req.params;
  if (!isValidId(_id)) return res.status(404).json({ message: "Comment unavailable" });

  try {
    const target = await comment.findById(_id);
    if (!target) return res.status(404).json({ message: "Comment not found" });
    if (String(target.userid) !== String(authUser._id)) {
      return res.status(403).json({ message: "You can only delete your own comments" });
    }

    if (target.parentId) {
      await comment.updateOne({ _id: target.parentId }, { $inc: { replyCount: -1 } });
    }
    await comment.deleteMany({ parentId: _id });
    await comment.deleteOne({ _id });
    return res.status(200).json({ comment: true });
  } catch (error) {
    console.error("deletecomment error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const editcomment = async (req, res) => {
  const authUser = req.authUser;
  if (!authUser) return res.status(401).json({ message: "Login required" });
  const { id: _id } = req.params;
  const { commentbody } = req.body;
  if (!isValidId(_id)) return res.status(404).json({ message: "Comment unavailable" });
  if (!commentbody || !String(commentbody).trim()) {
    return res.status(400).json({ message: "Comment cannot be empty" });
  }

  try {
    const target = await comment.findById(_id);
    if (!target) return res.status(404).json({ message: "Comment not found" });
    if (String(target.userid) !== String(authUser._id)) {
      return res.status(403).json({ message: "You can only edit your own comments" });
    }

    const updated = await comment.findByIdAndUpdate(
      _id,
      { $set: { commentbody: String(commentbody).trim().slice(0, 10000), edited: true, editedAt: new Date() } },
      { new: true }
    );
    const decorated = decorate([updated], authUser._id);
    return res.status(200).json(decorated[0]);
  } catch (error) {
    console.error("editcomment error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
