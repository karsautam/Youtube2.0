import video from "../Modals/video.js";
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { uploadMedia } from "../cloudinary.js";
import { v2 as cloudinary } from "cloudinary";

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

const renditionsEnabled = () => process.env.SKIP_RENDITIONS !== "true";

async function generateRenditionsCloud(videoFilePath) {
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
    results.push({ height: sourceHeight, filepath: videoFilePath.replace(/\\/g, "/") });
  }
  for (const target of targets) {
    const outPath = path.join(renditionsDir, `${target}.mp4`);
    for (const ffmpeg of ffmpegCandidates()) {
      try {
        await execFileAsync(
          ffmpeg,
          [
            "-y", "-i", videoFilePath,
            "-vf", `scale=-2:${target}`,
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "28",
            "-c:a", "aac", "-b:a", "128k",
            outPath,
          ],
          { timeout: 180000 * 10 }
        );
        const cloudUrl = await uploadMedia(outPath, "video");
        if (cloudUrl) {
          results.push({ height: target, filepath: cloudUrl });
          fs.rm(outPath, { force: true }, () => {});
        } else {
          results.push({ height: target, filepath: outPath.replace(/\\/g, "/") });
        }
        break;
      } catch (error) {
        continue;
      }
    }
  }
  return results;
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
      const qualities = renditionsEnabled()
        ? await generateRenditionsCloud(videoFile.path)
        : [];
      const cloudUrl = await uploadMedia(videoFile.path, "video");
      if (cloudUrl) {
        finalFilepath = cloudUrl;
        if (thumbnail && fs.existsSync(thumbnail)) {
          const cloudThumb = await uploadMedia(thumbnail, "image");
          if (cloudThumb) finalThumbnail = cloudThumb;
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
        qualities,
      });
      await file.save();

      fs.rm(path.resolve(videoFile.path), { force: true }, () => {});
      if (thumbnail && fs.existsSync(thumbnail)) {
        fs.rm(path.resolve(thumbnail), { force: true }, () => {});
      }
      const renditionsDir = path.join(path.dirname(videoFile.path), "renditions");
      fs.rm(renditionsDir, { recursive: true, force: true }, () => {});

      return res.status(201).json("file uploaded successfully");
    } catch (error) {
      console.error(" error:", error);
      return res.status(500).json({ message: "Something went wrong" });
    }
  }
};
export const deletevideo = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const vid = await video.findById(id);
    if (!vid) return res.status(404).json({ message: "Video not found" });
    if (vid.uploader !== userId)
      return res.status(403).json({ message: "Not authorized" });
    await video.findByIdAndDelete(id);
    return res.status(200).json({ message: "Video deleted" });
  } catch (error) {
    console.error(" delete error:", error);
    return res.status(500).json({ message: "Something went wrong" });
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

export const updatevideo = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, videotitle } = req.body;
    const vid = await video.findById(id);
    if (!vid) return res.status(404).json({ message: "Video not found" });
    if (String(vid.uploader) !== String(userId))
      return res.status(403).json({ message: "Not authorized" });
    if (videotitle !== undefined) vid.videotitle = videotitle;
    await vid.save();
    return res.status(200).json(vid);
  } catch (error) {
    console.error(" updatevideo error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

const CLOUDINARY_VIDEO_LIMIT = 100 * 1024 * 1024;

export const streamToCloudinary = async (req, res) => {
  try {
    const videoFile = req.files?.file?.[0] ?? req.file;
    if (!videoFile) {
      return res.status(400).json({ message: "No video file provided" });
    }

    console.log(`streamToCloudinary: received ${videoFile.originalname} (${(videoFile.size / 1024 / 1024).toFixed(1)}MB)`);

    let secure_url;
    if (videoFile.size > CLOUDINARY_VIDEO_LIMIT) {
      const relPath = videoFile.path.replace(/\\/g, "/").replace(/^.*?uploads\//, "uploads/");
      secure_url = `LOCAL:${relPath}`;
      console.log(`File too large for Cloudinary, stored locally: ${relPath}`);
    } else {
      secure_url = await uploadMedia(videoFile.path, "video");
      fs.rm(videoFile.path, { force: true }, () => {});
      console.log("streamToCloudinary: cloudUrl =", secure_url);
    }

    if (!secure_url) {
      return res.status(500).json({ message: "Upload failed" });
    }

    const subtitles = [];
    if (req.files?.subtitles) {
      for (const f of req.files.subtitles) {
        const subUrl = await uploadMedia(f.path, "raw");
        fs.rm(f.path, { force: true }, () => {});
        if (subUrl) {
          const base = path.basename(f.originalname, path.extname(f.originalname));
          subtitles.push({
            label: base || f.originalname,
            lang: "en",
            filepath: subUrl,
          });
        }
      }
    }

    return res.status(200).json({ secure_url, subtitles });
  } catch (error) {
    console.error("streamToCloudinary error:", error);
    return res.status(500).json({ message: "Upload to cloud failed" });
  }
};

export const uploadCover = async (req, res) => {
  try {
    const coverFile = req.file;
    if (!coverFile) {
      return res.status(400).json({ message: "No image file provided" });
    }
    const cloudUrl = await uploadMedia(coverFile.path, "image");
    fs.rm(coverFile.path, { force: true }, () => {});
    if (!cloudUrl) {
      return res.status(500).json({ message: "Cover upload failed" });
    }
    return res.status(200).json({ thumbnail: cloudUrl });
  } catch (error) {
    console.error("uploadCover error:", error);
    return res.status(500).json({ message: "Cover upload failed" });
  }
};

export const saveDirectUpload = async (req, res) => {
  try {
    const { videotitle, videochanel, uploader, filepath, thumbnail, filesize, qualities, subtitles } = req.body;
    if (!videotitle || !filepath || !uploader)
      return res.status(400).json({ message: "Missing required fields" });
    const saved = await video.create({
      videotitle,
      filename: filepath.split("/").pop(),
      filetype: "video/mp4",
      filepath,
      thumbnail: thumbnail || "",
      filesize: String(filesize || 0),
      videochanel: videochanel || "",
      uploader,
      qualities: qualities || [],
      subtitles: subtitles || [],
    });

    (async () => {
      try {
        const isLocal = filepath.startsWith("uploads/");
        if (isLocal) {
          const absPath = path.resolve(filepath);
          if (fs.existsSync(absPath)) {
            if (!thumbnail) {
              const thumb = await generateThumbnail(absPath);
              if (thumb) await video.updateOne({ _id: saved._id }, { $set: { thumbnail: thumb } });
            }
            if (renditionsEnabled() && (!qualities || qualities.length === 0)) {
              processRenditions(saved._id, absPath);
            }
          }
        } else if (renditionsEnabled() && (!thumbnail || !qualities || qualities.length === 0)) {
          const { default: axios } = await import("axios");
          const { default: os } = await import("os");
          const { default: crypto } = await import("crypto");
          const tmpDir = path.join(os.tmpdir(), "yt_bg_" + crypto.randomUUID());
          fs.mkdirSync(tmpDir, { recursive: true });
          const tmpPath = path.join(tmpDir, "source.mp4");
          const resp = await axios({ url: filepath, method: "GET", responseType: "stream", timeout: 600000 });
          await new Promise((resolve, reject) => {
            const ws = fs.createWriteStream(tmpPath);
            resp.data.pipe(ws);
            ws.on("finish", resolve);
            ws.on("error", reject);
          });
          if (!thumbnail) {
            const thumb = await generateThumbnail(tmpPath);
            if (thumb) await video.updateOne({ _id: saved._id }, { $set: { thumbnail: thumb } });
          }
          if (!qualities || qualities.length === 0) {
            const renditions = await generateRenditionsCloud(tmpPath);
            if (renditions.length > 0) {
              await video.updateOne({ _id: saved._id }, { $set: { qualities: renditions } });
              console.log(`renditions ready for ${saved._id}: ${renditions.map((q) => q.height + "p").join(", ")}`);
            }
          }
          fs.rm(tmpDir, { recursive: true, force: true }, () => {});
        }
      } catch (err) {
        console.error(`background processing failed for ${saved._id}:`, err?.message);
      }
    })();

    return res.status(201).json(saved);
  } catch (error) {
    console.error("saveDirectUpload error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
