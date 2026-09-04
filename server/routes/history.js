import express from "express";
import {
  getallhistoryVideo,
  handlehistory,
  handleview,
  removehistory,
  clearhistory,
} from "../controllers/history.js";

const routes = express.Router();
routes.get("/:userId", getallhistoryVideo);
routes.post("/views/:videoId", handleview);
routes.post("/:videoId", handlehistory);
routes.delete("/clear/:userId", clearhistory);
routes.delete("/:id", removehistory);
export default routes;
