import express from "express";
import {
  deletecomment,
  getallcomment,
  getreplies,
  postcomment,
  editcomment,
  togglecommentlike,
  togglecommentdislike,
  reportcomment,
  getreports,
  resolvereport,
} from "../controllers/comment.js";
import { requireAuth } from "../middleware/auth.js";

const routes = express.Router();
routes.get("/report", requireAuth, getreports);
routes.post("/report/:id/resolve", requireAuth, resolvereport);
routes.post("/report/:id", requireAuth, reportcomment);
routes.get("/reply/:id", getreplies);
routes.post("/postcomment", requireAuth, postcomment);
routes.post("/editcomment/:id", requireAuth, editcomment);
routes.post("/like/:id", requireAuth, togglecommentlike);
routes.post("/dislike/:id", requireAuth, togglecommentdislike);
routes.delete("/deletecomment/:id", requireAuth, deletecomment);
routes.get("/:videoid", getallcomment);
export default routes;