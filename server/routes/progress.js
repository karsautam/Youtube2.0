import express from "express";
import {
  getProgress,
  saveProgress,
  clearAllProgress,
} from "../controllers/progress.js";

const routes = express.Router();

routes.post("/:videoId", saveProgress);
routes.get("/:userId/:videoId", getProgress);
routes.delete("/:userId", clearAllProgress);

export default routes;
