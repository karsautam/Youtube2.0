import video from "../Modals/video.js";
import like from "../Modals/like.js";
import dislike from "../Modals/dislike.js";

async function getCounts(videoId) {
  const vid = await video.findById(videoId).select("Like Dislike").lean();
  return {
    likes: vid?.Like ?? 0,
    dislikes: vid?.Dislike ?? 0,
  };
}

export const handlelike = async (req, res) => {
  const { userId } = req.body;
  const { videoId } = req.params;
  if (!userId || !videoId) {
    return res.status(400).json({ message: "userId and videoId are required" });
  }
  try {
    const existingLike = await like.findOne({ viewer: userId, videoid: videoId });
    if (existingLike) {
      await like.deleteOne({ _id: existingLike._id });
      await video.findByIdAndUpdate(videoId, { $inc: { Like: -1 } });
      const counts = await getCounts(videoId);
      return res.status(200).json({ liked: false, disliked: false, ...counts });
    }

    const existingDislike = await dislike.findOne({ viewer: userId, videoid: videoId });
    if (existingDislike) {
      await dislike.deleteOne({ _id: existingDislike._id });
      await video.findByIdAndUpdate(videoId, { $inc: { Dislike: -1 } });
    }
    await like.create({ viewer: userId, videoid: videoId });
    await video.findByIdAndUpdate(videoId, { $inc: { Like: 1 } });
    const counts = await getCounts(videoId);
    return res.status(200).json({ liked: true, disliked: false, ...counts });
  } catch (error) {
    if (error?.code === 11000) {
      const counts = await getCounts(videoId);
      const liked = !!(await like.findOne({ viewer: userId, videoid: videoId }));
      const disliked = !!(await dislike.findOne({ viewer: userId, videoid: videoId }));
      return res.status(200).json({ liked, disliked, ...counts });
    }
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const handledislike = async (req, res) => {
  const { userId } = req.body;
  const { videoId } = req.params;
  if (!userId || !videoId) {
    return res.status(400).json({ message: "userId and videoId are required" });
  }
  try {
    const existingDislike = await dislike.findOne({ viewer: userId, videoid: videoId });
    if (existingDislike) {
      await dislike.deleteOne({ _id: existingDislike._id });
      await video.findByIdAndUpdate(videoId, { $inc: { Dislike: -1 } });
      const counts = await getCounts(videoId);
      return res.status(200).json({ liked: false, disliked: false, ...counts });
    }

    const existingLike = await like.findOne({ viewer: userId, videoid: videoId });
    if (existingLike) {
      await like.deleteOne({ _id: existingLike._id });
      await video.findByIdAndUpdate(videoId, { $inc: { Like: -1 } });
    }
    await dislike.create({ viewer: userId, videoid: videoId });
    await video.findByIdAndUpdate(videoId, { $inc: { Dislike: 1 } });
    const counts = await getCounts(videoId);
    return res.status(200).json({ liked: false, disliked: true, ...counts });
  } catch (error) {
    if (error?.code === 11000) {
      const counts = await getCounts(videoId);
      const liked = !!(await like.findOne({ viewer: userId, videoid: videoId }));
      const disliked = !!(await dislike.findOne({ viewer: userId, videoid: videoId }));
      return res.status(200).json({ liked, disliked, ...counts });
    }
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getLikeStatus = async (req, res) => {
  const { videoId, userId } = req.params;
  if (!userId || !videoId) {
    return res.status(400).json({ message: "userId and videoId are required" });
  }
  try {
    const [liked, disliked, counts] = await Promise.all([
      like.findOne({ viewer: userId, videoid: videoId }).select("_id").lean(),
      dislike.findOne({ viewer: userId, videoid: videoId }).select("_id").lean(),
      getCounts(videoId),
    ]);
    return res.status(200).json({
      liked: !!liked,
      disliked: !!disliked,
      ...counts,
    });
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getallLikedVideo = async (req, res) => {
  const { userId } = req.params;
  try {
    const likevideo = await like
      .find({ viewer: userId })
      .populate({
        path: "videoid",
        model: "videofiles",
      })
      .exec();
    return res.status(200).json(likevideo);
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
