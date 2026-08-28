import watchprogress from "../Modals/progress.js";

export const COMPLETION_THRESHOLD = 0.9;

export const saveProgress = async (req, res) => {
  const { videoId } = req.params;
  const { userId, position, duration, completed } = req.body;
  if (!userId || !videoId) {
    return res.status(400).json({ message: "userId and videoId are required" });
  }
  try {
    const pos = Number(position) || 0;
    const dur = Number(duration) || 0;
    const threshold = Number(req.body.completionThreshold) || COMPLETION_THRESHOLD;
    const isCompleted =
      completed === true || (dur > 0 && pos / dur >= threshold);
    const progress = await watchprogress.findOneAndUpdate(
      { viewer: userId, videoid: videoId },
      {
        $set: {
          position: pos,
          duration: dur,
          completed: isCompleted,
          lastupdatedon: Date.now(),
        },
      },
      { upsert: true, new: true }
    );
    return res.status(200).json({ progress });
  } catch (error) {
    console.error(" saveProgress error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getProgress = async (req, res) => {
  const { userId, videoId } = req.params;
  try {
    const progress = await watchprogress.findOne({
      viewer: userId,
      videoid: videoId,
    });
    if (!progress) return res.status(200).json({ progress: null });
    return res.status(200).json({ progress });
  } catch (error) {
    console.error(" getProgress error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const clearAllProgress = async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    return res.status(400).json({ message: "userId is required" });
  }
  try {
    await watchprogress.deleteMany({ viewer: userId });
    return res.status(200).json({ message: "Progress cleared" });
  } catch (error) {
    console.error(" clearAllProgress error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
