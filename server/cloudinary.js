import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

export async function uploadMedia(filePath, resourceType = "video") {
  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: resourceType,
      folder: "yourtube",
    });
    return result.secure_url;
  } catch (error) {
    console.error(`cloudinary upload failed (${resourceType}):`, error?.message);
    return null;
  }
}

export function destroyMedia(publicId, resourceType = "video") {
  return cloudinary.uploader
    .destroy(publicId, { resource_type: resourceType })
    .catch(() => {});
}
