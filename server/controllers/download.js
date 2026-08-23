import fs from "fs";
import path from "path";
import video from "../Modals/video.js";
import Download from "../Modals/download.js";
import Subscription from "../Modals/subscription.js";

// Minimum plan rank required to download a given resolution
const PLAN_RANK = { free: 0, bronze: 1, silver: 2, gold: 3 };
const QUALITY_MIN_RANK = { 240: 0, 360: 0, 480: 0, 720: 1, 1080: 2 };
const DEDUPE_WINDOW_MS = 5 * 60 * 1000; // repeated requests within window reuse record

function requiredRankForHeight(height) {
  if (!Number.isFinite(height)) return 0; // unknown height -> treat as standard
  const known = QUALITY_MIN_RANK[height];
  return known !== undefined ? known : 3; // anything above 1080 (e.g. 4K) = gold
}

async function getActiveSub(userId) {
  const sub = await Subscription.findOne({ userId }).lean();
  if (
    sub &&
    sub.plan !== "free" &&
    sub.expiryDate &&
    new Date(sub.expiryDate) < new Date()
  ) {
    // downloads restricted after subscription expiry
    return { ...sub, plan: "free", status: "expired" };
  }
  if (sub && sub.status !== "active" && sub.plan === "free") return sub;
  return sub;
}

function parseUserAgent(ua = "") {
  let browser = "Unknown browser";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/chrome|crios/i.test(ua)) browser = "Chrome";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/safari/i.test(ua)) browser = "Safari";
  else if (/opera|opr/i.test(ua)) browser = "Opera";

  let device = "Desktop";
  if (/mobile|iphone|android(?!.*tablet)/i.test(ua)) device = "Mobile";
  else if (/ipad|tablet/i.test(ua)) device = "Tablet";
  return { browser, device };
}

export function resolveQualityTarget(vid, requestedQuality) {
  const qualities = Array.isArray(vid.qualities) ? vid.qualities : [];
  const maxHeightKnown = qualities.length
    ? Math.max(...qualities.map((q) => q.height || 0))
    : null;
  if (requestedQuality && requestedQuality !== "original") {
    const height = parseInt(requestedQuality, 10);
    const match = qualities.find((q) => q.height === height);
    if (match) {
      return {
        path: match.filepath,
        height,
        label: `${height}p`,
        sizeBytes: null,
      };
    }
    // fall back to the highest rendition at or below the request
    const below = qualities
      .filter((q) => q.height <= height)
      .sort((a, b) => b.height - a.height)[0];
    if (below) {
      return {
        path: below.filepath,
        height: below.height,
        label: `${below.height}p`,
        sizeBytes: null,
      };
    }
  }
  return {
    path: vid.filepath,
    height: maxHeightKnown, // gate originals by the best known resolution
    label: "original",
    sizeBytes: Number(vid.filesize) || 0,
  };
}

export const startDownload = async (req, res) => {
  const { videoId } = req.params;
  const { userId, quality } = req.body;
  if (!userId) return res.status(400).json({ message: "userId is required" });
  try {
    const vid = await video.findById(videoId).lean();
    if (!vid) {
      return res
        .status(404)
        .json({ message: "Video not found or no longer accessible" });
    }

    // resolve which file this download refers to
    const target = resolveQualityTarget(vid, quality);
    const neededRank = requiredRankForHeight(target.height);

    const sub = await getActiveSub(userId);
    const plan = PLAN_RANK[sub?.plan] !== undefined ? sub.plan : "free";
    const userRank = PLAN_RANK[plan];

    if (userRank < neededRank) {
      const tierName = ["Free", "Bronze", "Silver", "Gold"][neededRank];
      return res.status(403).json({
        message: `The ${target.label} quality requires a ${tierName} plan or higher. Upgrade to download.`,
        upgradeRequired: true,
        requiredPlan: ["free", "bronze", "silver", "gold"][neededRank],
      });
    }

    // duplicate protection: same user+video+quality within window reuses record
    const recent = await Download.findOne({
      userId,
      videoId,
      quality: target.label,
      createdAt: { $gte: new Date(Date.now() - DEDUPE_WINDOW_MS) },
    }).lean();
    if (recent) {
      return res.status(200).json({
        message: "Already downloaded recently",
        duplicate: true,
        downloadId: recent._id,
        downloadUrl: `/download/file/${recent._id}`,
      });
    }

    const ua = req.headers["user-agent"] || "";
    const ip =
      (req.headers["x-forwarded-for"] || "")
        .split(",")[0]
        .trim() ||
      req.socket?.remoteAddress ||
      "";
    const { browser, device } = parseUserAgent(ua);

    const doc = await Download.create({
      userId,
      videoId,
      plan,
      status: "completed",
      fileSizeBytes: target.sizeBytes || 0,
      fileName: vid.filename,
      quality: target.label,
      selectedPath: target.path,
      ipAddress: ip,
      device,
      browser,
    });

    return res.status(201).json({
      message: "Download started",
      downloadId: doc._id,
      downloadUrl: `/download/file/${doc._id}`,
    });
  } catch (error) {
    console.error("startDownload error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const serveDownloadFile = async (req, res) => {
  const { downloadId } = req.params;
  try {
    const record = await Download.findById(downloadId).populate("videoId");
    if (!record) return res.status(404).json({ message: "Download not found" });

    const filepath = record.selectedPath || record.videoId?.filepath || "";
    const safeName = (record.fileName || "video.mp4").replace(/[^\w.\- ]+/g, "_");

    if (/^https?:\/\//i.test(filepath)) {
      const attachUrl = filepath.replace("/upload/", "/upload/fl_attachment/");
      return res.redirect(attachUrl);
    }
    const absolute = path.resolve(filepath);
    if (!fs.existsSync(absolute)) {
      record.status = "failed";
      await record.save();
      return res.status(404).json({ message: "Video file is missing on server" });
    }
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}"`
    );
    return res.sendFile(absolute);
  } catch (error) {
    console.error("serveDownloadFile error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getDownloadHistory = async (req, res) => {
  const { userId } = req.params;
  try {
    const downloads = await Download.find({ userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate({ path: "videoId", model: "videofiles" })
      .lean();
    return res.status(200).json({ downloads });
  } catch (error) {
    console.error("getDownloadHistory error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const checkDownloaded = async (req, res) => {
  const { videoId, userId } = req.params;
  try {
    const exists = await Download.exists({ userId, videoId });
    return res.status(200).json({ downloaded: Boolean(exists) });
  } catch (error) {
    console.error("checkDownloaded error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const deleteDownload = async (req, res) => {
  const { videoId } = req.params;
  const { userId } = req.body;
  try {
    const deleted = await Download.findOneAndDelete({ videoId, userId });
    if (!deleted) {
      return res.status(404).json({ message: "Download record not found" });
    }
    return res
      .status(200)
      .json({ message: "Removed from your downloads", deleted: true });
  } catch (error) {
    console.error("deleteDownload error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
