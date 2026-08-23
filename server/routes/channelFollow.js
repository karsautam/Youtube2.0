import express from "express";
import {
  toggleSubscribe,
  getSubscriberCount,
  checkSubscription,
  getMySubscriptions,
} from "../controllers/channelFollow.js";

const routes = express.Router();

routes.post("/toggle", toggleSubscribe);
routes.get("/count/:channelId", getSubscriberCount);
routes.get("/check/:subscriberId/:channelId", checkSubscription);
routes.get("/my/:userId", getMySubscriptions);

export default routes;
