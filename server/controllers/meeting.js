import mongoose from "mongoose";
import users from "../Modals/Auth.js";
import meeting from "../Modals/meeting.js";
import jwt from "jsonwebtoken";
import { getActiveCount, findParticipantByUser } from "../socket/meetingStore.js";
import { MAX_PARTICIPANTS } from "../socket/meetingStore.js";

const MEET_SECRET = process.env.MEET_SECRET || "yourtube-meet-secret";

function generateRoomId() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 9; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function generatePasscode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const createMeeting = async (req, res) => {
  const { email, title } = req.body;
  try {
    if (!email) {
      return res.status(400).json({ message: "You must be signed in" });
    }
    const existingUser = await users.findOne({ email });
    if (!existingUser) {
      return res.status(401).json({ message: "User not found" });
    }
    const roomId = generateRoomId();
    const passcode = req.body.passcode
      ? req.body.passcode
      : req.body.requirePasscode
      ? generatePasscode()
      : "";

    const created = await meeting.create({
      roomId,
      hostId: String(existingUser._id),
      hostName: existingUser.name || existingUser.email,
      title: title || "Video Meeting",
      passcode,
    });

    return res.status(201).json({
      roomId,
      joinUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/meeting/${roomId}`,
      passcode,
      title: created.title,
      startedAt: created.startedAt,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const joinMeeting = async (req, res) => {
  const { roomId, email, passcode } = req.body;
  try {
    if (!roomId || !email) {
      return res.status(400).json({ message: "roomId and email are required" });
    }
    const existingUser = await users.findOne({ email });
    if (!existingUser) {
      return res.status(401).json({ message: "User not found" });
    }
    const found = await meeting.findOne({ roomId: String(roomId).trim().toUpperCase() });
    if (!found) {
      return res.status(404).json({ message: "Meeting not found" });
    }
    if (found.endedAt) {
      return res.status(410).json({ message: "This meeting has ended" });
    }
    const userId = String(existingUser._id);
    const existingParticipant = findParticipantByUser(found.roomId, userId);
    if (found.locked && !existingParticipant) {
      return res.status(423).json({ message: "This meeting is locked" });
    }
    if (found.passcode && found.passcode !== String(passcode || "")) {
      return res.status(403).json({ message: "Incorrect meeting passcode" });
    }

    const active = getActiveCount(found.roomId, userId);
    if (active >= MAX_PARTICIPANTS) {
      return res.status(429).json({
        message: `This meeting is full (max ${MAX_PARTICIPANTS} participants)`,
      });
    }

    const token = jwt.sign(
      {
        roomId: found.roomId,
        userId,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 4,
      },
      MEET_SECRET
    );

    return res.status(200).json({
      roomId: found.roomId,
      token,
      title: found.title,
      hostId: found.hostId,
      hostName: found.hostName,
      locked: found.locked,
      passcodeRequired: Boolean(found.passcode),
      startedAt: found.startedAt,
      user: {
        id: userId,
        email: existingUser.email,
        name: existingUser.name || existingUser.email,
        image: existingUser.image || "",
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getMeeting = async (req, res) => {
  const { roomId } = req.params;
  try {
    const found = await meeting.findOne({ roomId: String(roomId).trim().toUpperCase() });
    if (!found) {
      return res.status(404).json({ message: "Meeting not found" });
    }
    return res.status(200).json({
      roomId: found.roomId,
      title: found.title,
      hostId: found.hostId,
      hostName: found.hostName,
      locked: found.locked,
      startedAt: found.startedAt,
      endedAt: found.endedAt,
      passcodeRequired: Boolean(found.passcode),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const endMeeting = async (req, res) => {
  const { roomId, email } = req.body;
  try {
    const found = await meeting.findOne({ roomId: String(roomId).trim().toUpperCase() });
    if (!found) {
      return res.status(404).json({ message: "Meeting not found" });
    }
    const host = await users.findOne({ email });
    if (!host || String(host._id) !== found.hostId) {
      return res.status(403).json({ message: "Only the host can end the meeting" });
    }
    found.endedAt = new Date();
    await found.save();
    return res.status(200).json({ message: "Meeting ended", roomId: found.roomId });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const uploadChatFile = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded or file type not allowed" });
    }
    const url = `${process.env.BACKEND_PUBLIC_URL || "http://localhost:5000"}/uploads/${req.file.filename}`;
    return res.status(200).json({
      url,
      name: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
