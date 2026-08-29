import mongoose from "mongoose";
import fs from "fs";
import users from "../Modals/Auth.js";
import { uploadMedia } from "../cloudinary.js";

export const getUserById = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }
  try {
    const found = await users.findById(id).select("-__v");
    if (!found) return res.status(404).json({ message: "User not found" });
    return res.status(200).json(found);
  } catch (error) {
    console.error("getUserById error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const login = async (req, res) => {
  const { email, name, image } = req.body;

  try {
    const existingUser = await users.findOne({ email });

    if (!existingUser) {
      const newUser = await users.create({ email, name, image });
      return res.status(201).json({ result: newUser });
    } else {
      return res.status(200).json({ result: existingUser });
    }
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
export const updateprofile = async (req, res) => {
  const { id: _id } = req.params;
  const { channelname, description, image } = req.body;
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(500).json({ message: "User unavailable..." });
  }
  try {
    const updatedata = await users.findByIdAndUpdate(
      _id,
      {
        $set: {
          channelname: channelname,
          description: description,
          ...(image ? { image } : {}),
        },
      },
      { new: true }
    );
    return res.status(201).json(updatedata);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const uploadChannelImage = async (req, res) => {
  const imageFile = req.file;
  if (!imageFile) return res.status(400).json({ message: "No image provided" });
  try {
    const url = await uploadMedia(imageFile.path, "image");
    fs.rm(imageFile.path, { force: true }, () => {});
    if (!url) return res.status(500).json({ message: "Image upload failed" });
    return res.status(200).json({ url });
  } catch (error) {
    console.error("uploadChannelImage error:", error);
    return res.status(500).json({ message: "Image upload failed" });
  }
};
