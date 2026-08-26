import mongoose from "mongoose";
import users from "../Modals/Auth.js";

export async function requireAuth(req, res, next) {
  const userId = req.body?.userId || req.body?.uploader;
  if (!userId) {
    return res.status(401).json({ message: "Login required" });
  }
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(401).json({ message: "Invalid user" });
  }
  try {
    const user = await users.findById(userId).lean();
    if (!user) {
      return res.status(401).json({ message: "User not found — login required" });
    }
    req.authUser = user;
    next();
  } catch (error) {
    console.error("requireAuth error:", error);
    return res.status(500).json({ message: "Auth check failed" });
  }
}
