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
export default routes;
