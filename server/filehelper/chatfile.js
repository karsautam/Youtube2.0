"use strict";
import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads");
  },
  filename: (req, file, cb) => {
    const clean = file.originalname.replace(/[^\w.\-]+/g, "_");
    cb(null, new Date().toISOString().replace(/:/g, "-") + "-" + clean);
  },
});

const filefilter = (req, file, cb) => {
  const allowed = [
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/json",
    "application/zip",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "video/webm",
    "video/mp4",
    "audio/webm",
    "audio/mp3",
    "audio/wav",
    "audio/ogg",
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

const upload = multer({
  storage,
  fileFilter: filefilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});
export default upload;
