import express from "express";
import {
  login,
  updateprofile,
  getUserById,
  uploadChannelImage,
} from "../controllers/auth.js";
import upload from "../filehelper/filehelper.js";
const routes = express.Router();

routes.post("/login", login);
routes.get("/:id", getUserById);
routes.patch("/update/:id", updateprofile);
routes.post("/upload-image", upload.single("image"), uploadChannelImage);
export default routes;
