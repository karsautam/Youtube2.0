import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import { createServer } from "http";
import { Server } from "socket.io";
import userroutes from "./routes/auth.js";
import videoroutes from "./routes/video.js";
import likeroutes from "./routes/like.js";
import watchlaterroutes from "./routes/watchlater.js";
import historyrroutes from "./routes/history.js";
import progressroutes from "./routes/progress.js";
import commentroutes from "./routes/comment.js";
import meetingroutes from "./routes/meeting.js";
import subscriptionroutes, { webhookHandler } from "./routes/subscription.js";
import channelfollowroutes from "./routes/channelFollow.js";
import downloadroutes from "./routes/download.js";
import { autoExpireSubscriptions } from "./controllers/subscription.js";
import initMeetingSocket from "./socket/meeting.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({ limit: "30mb", extended: true }));
app.use(express.urlencoded({ limit: "30mb", extended: true }));
app.use("/uploads", express.static("uploads"));
app.post("/subscription/webhook", express.raw({ type: "application/json" }), webhookHandler);
app.get("/", (req, res) => {
  res.send("You tube backend is working");
});
app.use(bodyParser.json());
app.use("/user", userroutes);
app.use("/video", videoroutes);
app.use("/like", likeroutes);
app.use("/watch", watchlaterroutes);
app.use("/history", historyrroutes);
app.use("/progress", progressroutes);
app.use("/comment", commentroutes);
app.use("/meet", meetingroutes);
app.use("/subscription", subscriptionroutes);
app.use("/channelfollow", channelfollowroutes);
app.use("/download", downloadroutes);

const PORT = process.env.PORT || 5000;

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  maxHttpBufferSize: 1e6,
});
initMeetingSocket(io);

httpServer.listen(PORT,"0.0.0.0", () => {
  console.log(`server running on port ${PORT}`);
  setInterval(autoExpireSubscriptions(), 60 * 60 * 1000);
  autoExpireSubscriptions()();
});

const DBURL = process.env.DB_URL;
mongoose
  .connect(DBURL)
  .then(() => {
    console.log("Mongodb connected");
  })
  .catch((error) => {
    console.log(error);
  });
