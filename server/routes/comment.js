import express from "express";
import {
  deletecomment,
  getallcomment,
  getreplies,
  postcomment,
  editcomment,
  togglecommentlike,
  togglecommentdislike,
} from "../controllers/comment.js";
import { requireAuth } from "../middleware/auth.js";

const routes = express.Router();
routes.get("/:videoid", getallcomment);
routes.get("/reply/:id", getreplies);
routes.post("/postcomment", requireAuth, postcomment);
routes.post("/editcomment/:id", requireAuth, editcomment);
routes.post("/like/:id", requireAuth, togglecommentlike);
routes.post("/dislike/:id", requireAuth, togglecommentdislike);
routes.delete("/deletecomment/:id", requireAuth, deletecomment);
export default routes;
