import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { default as axios } from "axios";
import { default as os } from "os";
import { default as crypto } from "crypto";
import dotenv from "dotenv";
import video from "./Modals/video.js";
import { execFile } from "child_process";
import { promisify } from "util";
import { uploadMedia } from "./cloudinary.js";

dotenv.config();
const execFileAsync = promisify(execFile);

function ffmpegCandidates() {
  return [
    process.env.FFMPEG_PATH,
    "ffmpeg",
    "C:\\Users\\karpr\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0-full_build\\bin\\ffmpeg.exe",
  ].filter(Boolean);
}

function ffprobeCandidates() {
  return [
    process.env.FFPROBE_PATH,
    "ffprobe",
    "C:\\Users\\karpr\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0-full_build\\bin\\ffprobe.exe",
  ].filter(Boolean);
}

async function getVideoHeight(videoFilePath) {
  for (const ffprobe of ffprobeCandidates()) {
    try {
      const { stdout } = await execFileAsync(ffprobe, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=height", "-of", "csv=p=0", videoFilePath], { timeout: 15000 });
      const height = parseInt(stdout.trim(), 10);
      if (Number.isFinite(height) && height > 0) return height;
    } catch { continue; }
  }
  return null;
}

async function generateThumbnail(videoFilePath) {
  const ext = path.extname(videoFilePath);
  const basename = path.basename(videoFilePath, ext);
  const thumbDir = path.join(path.dirname(videoFilePath), "thumbnails");
  const thumbPath = path.join(thumbDir, `${basename}.jpg`);
  fs.mkdirSync(thumbDir, { recursive: true });
  for (const seekMode of [["-ss", "3"], []]) {
    for (const ffmpeg of ffmpegCandidates()) {
      try {
        await execFileAsync(ffmpeg, ["-y", ...seekMode, "-i", videoFilePath, "-frames:v", "1", "-vf", "scale=1280:720:force_original_aspect_ratio=decrease", "-q:v", "2", thumbPath], { timeout: 30000 });
        if (fs.existsSync(thumbPath)) return thumbPath;
      } catch { continue; }
    }
  }
  return null;
}

async function backfill(vid) {
  console.log(`\n--- Backfilling: ${vid.videotitle} ---`);
  const tmpDir = path.join(os.tmpdir(), "yt_backfill_" + crypto.randomUUID());
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmpPath = path.join(tmpDir, "source.mp4");

  try {
    console.log("Downloading from Cloudinary...");
    const resp = await axios({ url: vid.filepath, method: "GET", responseType: "stream", timeout: 600000 });
    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(tmpPath);
      resp.data.pipe(ws);
      ws.on("finish", resolve);
      ws.on("error", reject);
    });
    console.log("Downloaded.");

    const sourceHeight = await getVideoHeight(tmpPath);
    console.log("Source height:", sourceHeight);

    const renditionsDir = path.join(tmpDir, "renditions");
    fs.mkdirSync(renditionsDir, { recursive: true });
    const targets = [1080, 720, 480, 360, 240].filter(h => sourceHeight && h < sourceHeight);
    const qualities = [];
    if (sourceHeight) qualities.push({ height: sourceHeight, filepath: vid.filepath });

    for (const target of targets) {
      const outPath = path.join(renditionsDir, `${target}.mp4`);
      for (const ffmpeg of ffmpegCandidates()) {
        try {
          console.log(`Transcoding ${target}p...`);
          await execFileAsync(ffmpeg, ["-y", "-i", tmpPath, "-vf", `scale=-2:${target}`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-c:a", "aac", "-b:a", "128k", outPath], { timeout: 180000 * 10 });
          const cloudUrl = await uploadMedia(outPath, "video");
          if (cloudUrl) {
            qualities.push({ height: target, filepath: cloudUrl });
            console.log(`  ${target}p → Cloudinary`);
          }
          fs.rm(outPath, { force: true }, () => {});
          break;
        } catch { continue; }
      }
    }

    if (!vid.thumbnail) {
      console.log("Generating thumbnail...");
      const thumbPath = await generateThumbnail(tmpPath);
      if (thumbPath) {
        const thumbUrl = await uploadMedia(thumbPath, "image");
        if (thumbUrl) {
          await video.updateOne({ _id: vid._id }, { $set: { thumbnail: thumbUrl } });
          console.log("Thumbnail saved.");
        }
        fs.rm(thumbPath, { force: true }, () => {});
      }
    }

    await video.updateOne({ _id: vid._id }, { $set: { qualities } });
    console.log(`Done! Qualities: ${qualities.map(q => q.height + "p").join(", ")}`);
  } catch (err) {
    console.error("Backfill failed:", err.message);
  } finally {
    fs.rm(tmpDir, { recursive: true, force: true }, () => {});
  }
}

async function main() {
  await mongoose.connect(process.env.DB_URL);
  console.log("Connected to MongoDB");

  const missing = await video.find({ $or: [{ qualities: { $size: 0 } }, { qualities: { $exists: false } }] });
  console.log(`Found ${missing.length} videos without qualities`);

  for (const vid of missing) {
    await backfill(vid);
  }

  await mongoose.disconnect();
  console.log("\nAll done!");
}

main();
