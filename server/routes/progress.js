import express from "express";
import { getProgress, saveProgress } from "../controllers/progress.js";

const routes = express.Router();

routes.post("/:videoId", saveProgress);
routes.get("/:userId/:videoId", getProgress);

export default routes;
