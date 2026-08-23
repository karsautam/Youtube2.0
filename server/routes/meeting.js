import express from "express";
import {
  createMeeting,
  joinMeeting,
  getMeeting,
  endMeeting,
  uploadChatFile,
} from "../controllers/meeting.js";
import upload from "../filehelper/chatfile.js";

const routes = express.Router();

routes.post("/create", createMeeting);
routes.post("/join", joinMeeting);
routes.post("/end", endMeeting);
routes.post("/upload", upload.single("file"), uploadChatFile);
routes.get("/:roomId", getMeeting);

export default routes;
