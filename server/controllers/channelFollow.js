import ChannelFollow from "../Modals/channelFollow.js";

export const toggleSubscribe = async (req, res) => {
  const { subscriberId, channelId } = req.body;
  if (!subscriberId || !channelId) {
    return res.status(400).json({ message: "subscriberId and channelId are required" });
  }
  try {
    const existing = await ChannelFollow.findOne({ subscriber: subscriberId, channel: channelId });
    if (existing) {
      await ChannelFollow.deleteOne({ _id: existing._id });
      const count = await ChannelFollow.countDocuments({ channel: channelId });
      return res.status(200).json({ subscribed: false, subscriberCount: count });
    }
    await ChannelFollow.create({ subscriber: subscriberId, channel: channelId });
    const count = await ChannelFollow.countDocuments({ channel: channelId });
    return res.status(200).json({ subscribed: true, subscriberCount: count });
  } catch (error) {
    console.error("toggleSubscribe error:", error);
    return res.status(500).json({ message: "Failed to toggle subscription" });
  }
};

export const getSubscriberCount = async (req, res) => {
  const { channelId } = req.params;
  try {
    const count = await ChannelFollow.countDocuments({ channel: channelId });
    return res.status(200).json({ subscriberCount: count });
  } catch (error) {
    console.error("getSubscriberCount error:", error);
    return res.status(500).json({ message: "Failed to get subscriber count" });
  }
};

export const checkSubscription = async (req, res) => {
  const { subscriberId, channelId } = req.params;
  try {
    const existing = await ChannelFollow.findOne({ subscriber: subscriberId, channel: channelId });
    return res.status(200).json({ subscribed: !!existing });
  } catch (error) {
    console.error("checkSubscription error:", error);
    return res.status(500).json({ message: "Failed to check subscription" });
  }
};

export const getMySubscriptions = async (req, res) => {
  const { userId } = req.params;
  try {
    const follows = await ChannelFollow.find({ subscriber: userId })
      .populate("channel", "channelname image description")
      .sort({ createdAt: -1 });
    // drop records whose channel user no longer exists
    const valid = follows.filter((f) => f.channel).map((f) => f.channel);
    const brokenIds = follows
      .filter((f) => !f.channel)
      .map((f) => f._id);
    if (brokenIds.length) {
      await ChannelFollow.deleteMany({ _id: { $in: brokenIds } });
    }
    return res.status(200).json({ subscriptions: valid });
  } catch (error) {
    console.error("getMySubscriptions error:", error);
    return res.status(500).json({ message: "Failed to get subscriptions" });
  }
};
