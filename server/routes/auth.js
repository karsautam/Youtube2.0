import express from "express";
import {
  login,
  verifyDeviceLogin,
  resendDeviceOtp,
  checkSessionStatus,
} from "../controllers/deviceAuth.js";
import {
  updateprofile,
  getUserById,
  uploadChannelImage,
} from "../controllers/auth.js";
import upload from "../filehelper/filehelper.js";
const routes = express.Router();

routes.post("/login", login);
routes.post("/verify-device-login", verifyDeviceLogin);
routes.post("/resend-device-otp", resendDeviceOtp);
routes.get("/session-status", checkSessionStatus);
routes.get("/:id", getUserById);
routes.patch("/update/:id", updateprofile);
routes.post("/upload-image", upload.single("image"), uploadChannelImage);
export default routes;