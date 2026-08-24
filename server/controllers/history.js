import video from "../Modals/video.js";
import history from "../Modals/history.js";
import videoview from "../Modals/videoview.js";

const registerView = async (videoId, viewerKey) => {
  const existing = await videoview.findOneAndUpdate(
    { videoid: videoId, viewerKey },
    { $setOnInsert: { videoid: videoId, viewerKey } },
    { upsert: true }
  );
  if (existing) return false;
  await video.findByIdAndUpdate(videoId, { $inc: { views: 1 } });
  return true;
};

export const handlehistory = async (req, res) => {
  const { userId } = req.body;
  const { videoId } = req.params;
  try {
    // keep a single entry per video per user; refresh its timestamp instead
    await history.findOneAndUpdate(
      { viewer: userId, videoid: videoId },
      { $set: { createdAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await registerView(videoId, `user:${userId}`);
    return res.status(200).json({ history: true });
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
export const handleview = async (req, res) => {
  const { videoId } = req.params;
  try {
    const forwarded = req.headers["x-forwarded-for"];
    const ip =
      typeof forwarded === "string" && forwarded.length > 0
        ? forwarded.split(",")[0].trim()
        : req.socket?.remoteAddress || "unknown";
    await registerView(videoId, `ip:${ip}`);
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
export const getallhistoryVideo = async (req, res) => {
  const { userId } = req.params;
  try {
    const historyvideo = await history
      .find({ viewer: userId })
      .sort({ createdAt: -1 })
      .populate({
        path: "videoid",
        model: "videofiles",
      })
      .exec();
    // drop entries whose video was deleted (and clean them from the DB)
    const valid = historyvideo.filter((h) => h.videoid);
    const orphanIds = historyvideo
      .filter((h) => !h.videoid)
      .map((h) => h._id);
    if (orphanIds.length) {
      await history.deleteMany({ _id: { $in: orphanIds } });
    }
    return res.status(200).json(valid);
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
