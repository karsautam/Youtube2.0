import express from "express";
import { getallvideo, uploadvideo, deletevideo, updatevideo, streamToCloudinary, uploadCover, saveDirectUpload } from "../controllers/video.js";
import upload from "../filehelper/filehelper.js";

const routes = express.Router();

routes.post(
  "/upload",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "subtitles", maxCount: 10 },
  ]),
  uploadvideo
);
routes.get("/getall", getallvideo);
routes.delete("/delete/:id", deletevideo);
routes.patch("/update/:id", updatevideo);
routes.post(
  "/stream-upload",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "subtitles", maxCount: 10 },
  ]),
  streamToCloudinary
);
routes.post("/upload-cover", upload.single("cover"), uploadCover);
routes.post("/save-direct-upload", saveDirectUpload);
routes.get("/debug-env", (req, res) => {
  res.json({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || null,
    api_key_set: !!process.env.CLOUDINARY_API_KEY,
    api_secret_set: !!process.env.CLOUDINARY_API_SECRET,
    skip_renditions: process.env.SKIP_RENDITIONS || null,
  });
});
export default routes;
