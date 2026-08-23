import express from "express";
import {
  getPlans,
  getSubscriptionStatus,
  createOrder,
  verifyPayment,
  cancelSubscription,
  reactivateSubscription,
  getBillingHistory,
  checkAccess,
  webhookHandler,
} from "../controllers/subscription.js";

const routes = express.Router();

routes.get("/plans", getPlans);
routes.get("/status/:userId", getSubscriptionStatus);
routes.post("/create-order", createOrder);
routes.post("/verify", verifyPayment);
routes.post("/cancel", cancelSubscription);
routes.post("/reactivate", reactivateSubscription);
routes.get("/billing/:userId", getBillingHistory);
routes.get("/access/:userId/:feature", checkAccess);

export { webhookHandler };
export default routes;
