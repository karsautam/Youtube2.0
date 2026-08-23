import video from "../Modals/video.js";
import history from "../Modals/history.js";

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
    await video.findByIdAndUpdate(videoId, { $inc: { views: 1 } });
    return res.status(200).json({ history: true });
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
export const handleview = async (req, res) => {
  const { videoId } = req.params;
  try {
    await video.findByIdAndUpdate(videoId, { $inc: { views: 1 } });
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
