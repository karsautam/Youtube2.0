"use strict";
import multer from "multer";
import fs from "fs";
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.mimetype.startsWith("video/")) {
      cb(null, "uploads");
    } else {
      fs.mkdirSync("uploads/subtitles", { recursive: true });
      cb(null, "uploads/subtitles");
    }
  },
  filename: (req, file, cb) => {
    cb(
      null,
      new Date().toISOString().replace(/:/g, "-") + "-" + file.originalname
    );
  },
});
const filefilter = (req, file, cb) => {
  if (file.mimetype.startsWith("video/")) {
    cb(null, true);
  } else if (
    file.mimetype === "text/vtt" ||
    file.mimetype === "text/plain" ||
    /\.(vtt|srt)$/i.test(file.originalname)
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};
const upload = multer({ storage: storage, fileFilter: filefilter });
export default upload;
