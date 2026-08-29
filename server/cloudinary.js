import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
  cloud_name: (process.env.CLOUDINARY_CLOUD_NAME || "").trim(),
  api_key: (process.env.CLOUDINARY_API_KEY || "").trim(),
  api_secret: (process.env.CLOUDINARY_API_SECRET || "").trim(),
});

export async function uploadMedia(filePath, resourceType = "video") {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: resourceType,
      folder: "yourtube",
      timeout: 600000,
    });
    return result.secure_url;
  } catch (error) {
    lastUploadError = error?.message || String(error);
    console.error(`cloudinary upload failed (${resourceType}):`, error?.message);
    return null;
  }
}

export let lastUploadError = null;

export function destroyMedia(publicId, resourceType = "video") {
  return cloudinary.uploader
    .destroy(publicId, { resource_type: resourceType })
    .catch(() => {});
}

export function generateSignedUploadParams(folder = "yourtube") {
  const timestamp = Math.round(Date.now() / 1000);
  const params = { timestamp };
  const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET);
  return {
    timestamp,
    signature,
    api_key: process.env.CLOUDINARY_API_KEY,
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    folder,
    resource_type: "video",
  };
}
