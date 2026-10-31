import express from "express";
import {
  checkDownloaded,
  deleteDownload,
  deleteDownloadById,
  getDownloadHistory,
  serveDownloadFile,
  startDownload,
} from "../controllers/download.js";

const routes = express.Router();
routes.post("/:videoId", startDownload);
routes.get("/file/:downloadId", serveDownloadFile);
routes.get("/history/:userId", getDownloadHistory);
routes.get("/check/:videoId/:userId", checkDownloaded);
routes.delete("/id/:downloadId", deleteDownloadById);
routes.delete("/record/:videoId", deleteDownload);
export default routes;
