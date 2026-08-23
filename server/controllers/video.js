import video from "../Modals/video.js";
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { uploadMedia } from "../cloudinary.js";

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
      const { stdout } = await execFileAsync(
        ffprobe,
        [
          "-v",
          "error",
          "-select_streams",
          "v:0",
          "-show_entries",
          "stream=height",
          "-of",
          "csv=p=0",
          videoFilePath,
        ],
        { timeout: 15000 }
      );
      const height = parseInt(stdout.trim(), 10);
      if (Number.isFinite(height) && height > 0) return height;
    } catch (error) {
      continue;
    }
  }
  return null;
}

async function generateRenditions(videoFilePath) {
  const ext = path.extname(videoFilePath);
  const basename = path.basename(videoFilePath, ext);
  const renditionsDir = path.join(
    path.dirname(videoFilePath),
    "renditions",
    basename
  );
  fs.mkdirSync(renditionsDir, { recursive: true });
  const sourceHeight = await getVideoHeight(videoFilePath);
  const targets = [1080, 720, 480, 360, 240].filter(
    (height) => sourceHeight && height < sourceHeight
  );
  const results = [];
  if (sourceHeight) {
    results.push({
      height: sourceHeight,
      filepath: videoFilePath.replace(/\\/g, "/"),
    });
  }
  for (const target of targets) {
    const outPath = path.join(renditionsDir, `${target}.mp4`);
    for (const ffmpeg of ffmpegCandidates()) {
      try {
        await execFileAsync(
          ffmpeg,
          [
            "-y",
            "-i",
            videoFilePath,
            "-vf",
            `scale=-2:${target}`,
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "28",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            outPath,
          ],
          { timeout: 180000 * 10 }
        );
        results.push({
          height: target,
          filepath: `uploads/renditions/${basename}/${target}.mp4`,
        });
        break;
      } catch (error) {
        continue;
      }
    }
  }
  return results;
}

export async function processRenditions(videoId, videoFilePath) {
  try {
    const qualities = await generateRenditions(videoFilePath);
    await video.updateOne({ _id: videoId }, { $set: { qualities } });
    console.log(`renditions ready for ${videoId}: ${qualities.map((q) => q.height + "p").join(", ")}`);
  } catch (error) {
    console.error(`rendition processing failed for ${videoId}:`, error);
  }
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
        await execFileAsync(
          ffmpeg,
          [
            "-y",
            ...seekMode,
            "-i",
            videoFilePath,
            "-frames:v",
            "1",
            "-vf",
            "scale=1280:720:force_original_aspect_ratio=decrease",
            "-q:v",
            "2",
            thumbPath,
          ],
          { timeout: 30000 }
        );
        if (fs.existsSync(thumbPath)) {
          return `uploads/thumbnails/${basename}.jpg`;
        }
      } catch (error) {
        continue;
      }
    }
  }
  return null;
}

export const uploadvideo = async (req, res) => {
  const videoFile = req.files?.file?.[0] ?? req.file;
  if (videoFile === undefined) {
    return res
      .status(404)
      .json({ message: "plz upload a mp4 video file only" });
  } else {
    try {
      const filepath = videoFile.path.replace(/\\/g, "/");
      const thumbnail = await generateThumbnail(videoFile.path);
      const subtitleTracks = (req.files?.subtitles || []).map((f) => {
        const base = path.basename(f.originalname, path.extname(f.originalname));
        return {
          label: base || f.originalname,
          lang: "en",
          filepath: f.path.replace(/\\/g, "/"),
        };
      });

      let finalFilepath = filepath;
      let finalThumbnail = thumbnail;
      const cloudUrl = await uploadMedia(videoFile.path, "video");
      if (cloudUrl) {
        finalFilepath = cloudUrl;
        if (thumbnail && fs.existsSync(thumbnail)) {
          const cloudThumb = await uploadMedia(thumbnail, "image");
          if (cloudThumb) finalThumbnail = cloudThumb;
        }
        fs.rm(path.resolve(videoFile.path), { force: true }, () => {});
        if (thumbnail && fs.existsSync(thumbnail)) {
          fs.rm(path.resolve(thumbnail), { force: true }, () => {});
        }
      }

      const file = new video({
        videotitle: req.body.videotitle,
        filename: videoFile.originalname,
        filepath: finalFilepath,
        filetype: videoFile.mimetype,
        thumbnail: finalThumbnail,
        filesize: videoFile.size,
        videochanel: req.body.videochanel || "Standalone",
        uploader: req.body.uploader,
        subtitles: subtitleTracks,
      });
      await file.save();
      if (!cloudUrl) processRenditions(file._id, videoFile.path);
      return res.status(201).json("file uploaded successfully");
    } catch (error) {
      console.error(" error:", error);
      return res.status(500).json({ message: "Something went wrong" });
    }
  }
};
export const getallvideo = async (req, res) => {
  try {
    const files = await video.find();
    return res.status(200).send(files);
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
