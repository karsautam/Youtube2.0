import comment from "../Modals/comment.js";
import commentreport from "../Modals/commentreport.js";
import mongoose from "mongoose";
import {
  filterCommentContent,
  isDuplicate,
  checkRate,
  hitRate,
  createCaptcha,
  verifyCaptcha,
  EDITABLE_WINDOW_MS,
} from "../utils/commentSafety.js";

const REPORT_REASONS = [
  "spam",
  "harassment",
  "offensive",
  "misinformation",
  "impersonation",
  "other",
];

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
      location: c.location || "",
      likesCount: c.likesCount || (c.likes ? c.likes.length : 0),
      dislikesCount: c.dislikesCount || (c.dislikes ? c.dislikes.length : 0),
      replyCount: c.replyCount || 0,
      edited: c.edited,
      editedAt: c.editedAt,
      revision: c.revision || 0,
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
  const { videoid, commentbody, parentId, captchaToken, captchaAnswer } =
    req.body || {};
  if (!videoid || !commentbody || !String(commentbody).trim()) {
    return res.status(400).json({ message: "Comment is required" });
  }

  try {
    if (parentId && !isValidId(parentId)) {
      return res.status(400).json({ message: "Invalid parent comment" });
    }

    // Rate limiting / flooding: after repeated posting, require CAPTCHA.
    const rate = checkRate(authUser._id);
    if (rate.limited) {
      if (!captchaToken || !verifyCaptcha(captchaToken, captchaAnswer)) {
        return res.status(429).json({
          message: "You're posting too quickly. Solve the CAPTCHA to continue.",
          needCaptcha: true,
          captcha: createCaptcha(),
        });
      }
    }

    // Content filter: profanity, links, emoji/special-char flooding.
    const filt = filterCommentContent(commentbody);
    if (filt.blocked) {
      return res.status(400).json({ message: filt.reason });
    }

    // Duplicate comment detection.
    if (isDuplicate(authUser._id, videoid, commentbody)) {
      return res
        .status(400)
        .json({ message: "You already posted this comment — please change it." });
    }

    const postcomment = new comment({
      videoid,
      parentId: parentId || null,
      commentbody: String(commentbody).trim().slice(0, 10000),
      userid: authUser._id,
      usercommented: authUser.name || authUser.channelname || "Anonymous",
      userimage: authUser.image || "",
      location: authUser.location || "",
    });
    await postcomment.save();

    if (postcomment.parentId) {
      await comment.updateOne(
        { _id: postcomment.parentId },
        { $inc: { replyCount: 1 } }
      );
    }

    hitRate(authUser._id);

    const [decorated] = decorate([postcomment], authUser._id);
    return res.status(200).json({ comment: true, data: decorated });
  } catch (error) {
    console.error("postcomment error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

function relevanceScore(c) {
  const ageHours = Math.max(
    0,
    (Date.now() - new Date(c.commentedon).getTime()) / 3600000
  );
  const recencyBoost = Math.max(0, 10 - ageHours / 24);
  return (c.likesCount || 0) * 3 + (c.replyCount || 0) * 5 + recencyBoost;
}

export const getallcomment = async (req, res) => {
  const { videoid } = req.params;
  const sort = req.query.sort || "newest";
  const userId = req.query.userId || null;

  try {
    let docs;
    const base = { videoid, parentId: null };
    if (sort === "oldest") {
      docs = await comment.find(base).sort({ commentedon: 1 });
    } else if (sort === "top") {
      docs = await comment.find(base).sort({ likesCount: -1, commentedon: -1 });
    } else if (sort === "relevant") {
      const all = await comment.find(base);
      all.sort((a, b) => relevanceScore(b) - relevanceScore(a));
      docs = all;
    } else {
      docs = await comment.find(base).sort({ commentedon: -1 });
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
    let dislikes = hadLike
      ? doc.dislikes
      : doc.dislikes.filter((x) => String(x) !== uid);

    await comment.updateOne(
      { _id: id },
      {
        $set: {
          likes,
          dislikes,
          likesCount: likes.length,
          dislikesCount: dislikes.length,
        },
      }
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
    let likes = hadDislike
      ? doc.likes
      : doc.likes.filter((x) => String(x) !== uid);

    await comment.updateOne(
      { _id: id },
      {
        $set: {
          likes,
          dislikes,
          likesCount: likes.length,
          dislikesCount: dislikes.length,
        },
      }
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
    const age = Date.now() - new Date(target.commentedon).getTime();
    if (age > EDITABLE_WINDOW_MS) {
      return res
        .status(403)
        .json({ message: "Comments can only be deleted within 24 hours of posting." });
    }

    if (target.parentId) {
      await comment.updateOne({ _id: target.parentId }, { $inc: { replyCount: -1 } });
    }
    await comment.deleteMany({ parentId: _id });
    await comment.deleteOne({ _id });
    await commentreport.deleteMany({ comment: _id });
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
  const { commentbody, revision } = req.body;
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
    const age = Date.now() - new Date(target.commentedon).getTime();
    if (age > EDITABLE_WINDOW_MS) {
      return res
        .status(403)
        .json({ message: "Comments can only be edited within 24 hours of posting." });
    }

    // Concurrent-edit guard: the client must post from the current revision.
    if (revision !== undefined && Number(revision) !== Number(target.revision)) {
      return res.status(409).json({
        message: "This comment was already edited — refresh and try again.",
      });
    }

    const filt = filterCommentContent(commentbody);
    if (filt.blocked) {
      return res.status(400).json({ message: filt.reason });
    }

    const history = target.editHistory || [];
    history.push({ body: target.commentbody, at: new Date() });
    if (history.length > 5) history.shift();

    const updated = await comment.findByIdAndUpdate(
      _id,
      {
        $set: {
          commentbody: String(commentbody).trim().slice(0, 10000),
          edited: true,
          editedAt: new Date(),
          revision: (target.revision || 0) + 1,
          editHistory: history,
        },
      },
      { new: true }
    );
    const decorated = decorate([updated], authUser._id);
    return res.status(200).json(decorated[0]);
  } catch (error) {
    console.error("editcomment error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ---------------- Reporting + moderation ----------------

export const reportcomment = async (req, res) => {
  const authUser = req.authUser;
  if (!authUser) return res.status(401).json({ message: "Login required" });
  const { id } = req.params;
  const { reason } = req.body || {};
  if (!isValidId(id)) return res.status(400).json({ message: "Invalid comment" });
  if (!REPORT_REASONS.includes(reason)) {
    return res.status(400).json({ message: "Invalid report reason" });
  }

  try {
    const target = await comment.findById(id);
    if (!target) return res.status(404).json({ message: "Comment not found" });

    // Prevent a user from reporting the same comment twice.
    const existing = await commentreport.findOne({
      comment: id,
      reporter: authUser._id,
    });
    if (existing) {
      return res.status(409).json({ message: "You already reported this comment." });
    }

    const report = new commentreport({
      comment: id,
      videoid: target.videoid,
      reporter: authUser._id,
      reporterName: authUser.name || authUser.channelname || "Anonymous",
      reason,
    });
    await report.save();
    return res.status(200).json({ comment: true, report: true });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ message: "You already reported this comment." });
    }
    console.error("reportcomment error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getreports = async (req, res) => {
  const authUser = req.authUser;
  if (!authUser) return res.status(401).json({ message: "Login required" });
  const { status } = req.query;
  try {
    const q = status ? { status } : {};
    const reports = await commentreport
      .find(q)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate({ path: "comment", model: "comment" })
      .lean();
    return res.status(200).json(reports);
  } catch (error) {
    console.error("getreports error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const resolvereport = async (req, res) => {
  const authUser = req.authUser;
  if (!authUser) return res.status(401).json({ message: "Login required" });
  const { id } = req.params;
  const { status, resolution, removeComment } = req.body || {};
  if (!["reviewed", "actioned", "dismissed"].includes(status)) {
    return res.status(400).json({ message: "Invalid report status" });
  }

  try {
    const report = await commentreport.findById(id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    report.status = status;
    report.resolution = resolution || null;
    report.moderatedAt = new Date();
    if (Boolean(removeComment)) {
      report.commentRemoved = true;
      await comment.deleteMany({ parentId: report.comment });
      await comment.deleteOne({ _id: report.comment });
    }
    await report.save();
    return res.status(200).json({ report: true });
  } catch (error) {
    console.error("resolvereport error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};