import express from "express";
import { sendOtp, verifyOtp } from "../controllers/otp.js";
const routes = express.Router();

routes.post("/send", sendOtp);
routes.post("/verify", verifyOtp);

export default routes;
