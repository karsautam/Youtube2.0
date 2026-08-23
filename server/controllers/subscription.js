import Razorpay from "razorpay";
import crypto from "crypto";
import Subscription from "../Modals/subscription.js";
import BillingHistory from "../Modals/billingHistory.js";
import User from "../Modals/Auth.js";
import { sendSubscriptionConfirmation, sendCancellationEmail } from "../services/email.js";

let razorpay;
function getRazorpay() {
  if (!razorpay) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpay;
}

const PLAN_HIERARCHY = { free: 0, bronze: 1, silver: 2, gold: 3 };

export const PLANS = [
  {
    id: "free",
    tier: "free",
    name: "Free",
    pricing: { monthly: 0, quarterly: 0, yearly: 0 },
    description: "Basic access to get started",
    features: {
      premiumVideos: false,
      maxVideoQuality: "480p",
      offlineDownloads: 0,
      adFree: false,
      priorityAccess: false,
      exclusiveCourses: false,
      backgroundPlay: false,
      maxWatchTimeMinutes: 120,
      maxDailyDownloads: 0,
      streamingSpeed: "standard",
      devicesSimultaneous: 1,
      customerSupport: "community",
    },
    badge: "Free",
    color: "#6b7280",
  },
  {
    id: "bronze",
    tier: "bronze",
    name: "Bronze",
    pricing: { monthly: 14900, quarterly: 39900, yearly: 119900 },
    description: "Enhanced access for casual viewers",
    features: {
      premiumVideos: true,
      maxVideoQuality: "720p",
      offlineDownloads: 10,
      adFree: true,
      priorityAccess: false,
      exclusiveCourses: false,
      backgroundPlay: true,
      maxWatchTimeMinutes: 360,
      maxDailyDownloads: 5,
      streamingSpeed: "fast",
      devicesSimultaneous: 1,
      customerSupport: "email",
    },
    badge: "Bronze",
    color: "#cd7f32",
  },
  {
    id: "silver",
    tier: "silver",
    name: "Silver",
    pricing: { monthly: 29900, quarterly: 79900, yearly: 239900 },
    description: "Premium experience for enthusiasts",
    features: {
      premiumVideos: true,
      maxVideoQuality: "1080p",
      offlineDownloads: 50,
      adFree: true,
      priorityAccess: true,
      exclusiveCourses: false,
      backgroundPlay: true,
      maxWatchTimeMinutes: 720,
      maxDailyDownloads: 20,
      streamingSpeed: "fast",
      devicesSimultaneous: 2,
      customerSupport: "priority_email",
    },
    badge: "Silver",
    color: "#9ca3af",
  },
  {
    id: "gold",
    tier: "gold",
    name: "Gold",
    pricing: { monthly: 49900, quarterly: 129900, yearly: 399900 },
    description: "Ultimate access with all features",
    features: {
      premiumVideos: true,
      maxVideoQuality: "4K",
      offlineDownloads: -1,
      adFree: true,
      priorityAccess: true,
      exclusiveCourses: true,
      backgroundPlay: true,
      maxWatchTimeMinutes: -1,
      maxDailyDownloads: -1,
      streamingSpeed: "ultra",
      devicesSimultaneous: 4,
      customerSupport: "priority_phone",
    },
    badge: "Gold",
    color: "#f59e0b",
  },
];

const PLAN_MAP = {};
PLANS.forEach((p) => { PLAN_MAP[p.tier] = p; });

function calcExpiryDate(billingCycle, startDate) {
  const d = new Date(startDate);
  if (billingCycle === "monthly") d.setMonth(d.getMonth() + 1);
  else if (billingCycle === "quarterly") d.setMonth(d.getMonth() + 3);
  else d.setFullYear(d.getFullYear() + 1);
  return d;
}

function generateInvoiceNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return "INV-" + ts + "-" + rand;
}

const razorpayPlanIds = {};
async function ensurePlans() {
  const existing = await getRazorpay().plans.all({ count: 100 });
  const tiers = ["bronze", "silver", "gold"];
  const cycles = ["monthly", "quarterly", "yearly"];
  for (const tier of tiers) {
    for (const cycle of cycles) {
      const planDef = PLANS.find((p) => p.tier === tier);
      if (!planDef) continue;
      const amount = planDef.pricing[cycle];
      if (!amount) continue;
      const key = tier + "_" + cycle;
      const period = cycle === "yearly" ? "yearly" : "monthly";
      const found = existing.items?.find(
        (p) => p.item?.name && p.item.name.includes(planDef.name) && p.period === period
      );
      if (found) {
        razorpayPlanIds[key] = found.id;
      } else {
        const created = await getRazorpay().plans.create({
          period,
          item: {
            name: planDef.name + " (" + cycle + ")",
            amount,
            currency: "INR",
            description: planDef.name + " " + cycle + " plan",
          },
        });
        razorpayPlanIds[key] = created.id;
      }
    }
  }
}

let plansReady;
function initPlans() {
  if (!plansReady) {
    plansReady = ensurePlans().catch(console.error);
  }
  return plansReady;
}

export const getPlans = async (_req, res) => {
  try {
    await initPlans();
    return res.status(200).json({ plans: PLANS });
  } catch (error) {
    console.error("getPlans error:", error);
    return res.status(500).json({ message: "Failed to load plans" });
  }
};

export const getSubscriptionStatus = async (req, res) => {
  const { userId } = req.params;
  try {
    const sub = await Subscription.findOne({ userId });
    if (!sub) {
      return res.status(200).json({
        plan: "free", status: "active", features: PLAN_MAP.free.features,
        billingCycle: null, startDate: null, expiryDate: null,
        nextRenewalDate: null, cancelAtPeriodEnd: false, daysRemaining: null, autoRenew: false,
      });
    }
    if (sub.expiryDate && new Date(sub.expiryDate) < new Date() && sub.plan !== "free") {
      sub.plan = "free";
      sub.status = "expired";
      sub.paymentStatus = "pending";
      await sub.save();
    }
    const planDef = PLAN_MAP[sub.plan] || PLAN_MAP.free;
    const now = new Date();
    const daysRemaining = sub.expiryDate
      ? Math.max(0, Math.ceil((new Date(sub.expiryDate) - now) / (1000 * 60 * 60 * 24)))
      : null;
    return res.status(200).json({
      plan: sub.plan, status: sub.status, features: planDef.features,
      billingCycle: sub.billingCycle, startDate: sub.startDate, expiryDate: sub.expiryDate,
      nextRenewalDate: sub.nextRenewalDate, cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      daysRemaining, autoRenew: sub.autoRenew, invoiceNumber: sub.invoiceNumber,
      amountPaid: sub.amountPaid, razorpayPaymentId: sub.razorpayPaymentId,
    });
  } catch (error) {
    console.error("getSubscriptionStatus error:", error);
    return res.status(500).json({ message: "Failed to get subscription status" });
  }
};

export const createOrder = async (req, res) => {
  const { userId, planId, billingCycle } = req.body;
  if (!userId || !planId || !billingCycle) {
    return res.status(400).json({ message: "userId, planId, and billingCycle are required" });
  }
  try {
    await initPlans();
    const planDef = PLAN_MAP[planId];
    if (!planDef) return res.status(400).json({ message: "Invalid plan" });

    if (planDef.tier === "free") {
      let sub = await Subscription.findOne({ userId });
      if (!sub) sub = new Subscription({ userId });
      sub.plan = "free";
      sub.status = "active";
      sub.billingCycle = billingCycle;
      sub.startDate = new Date();
      sub.expiryDate = null;
      sub.nextRenewalDate = null;
      sub.cancelAtPeriodEnd = false;
      sub.autoRenew = false;
      sub.razorpayOrderId = null;
      sub.razorpayPaymentId = null;
      sub.invoiceNumber = null;
      sub.amountPaid = 0;
      sub.paymentStatus = "captured";
      await sub.save();
      return res.status(200).json({ orderId: null, razorpayKeyId: null, amount: 0, plan: "free" });
    }

    const currentSub = await Subscription.findOne({ userId });
    const currentTierLevel = PLAN_HIERARCHY[currentSub?.plan || "free"] || 0;
    const newTierLevel = PLAN_HIERARCHY[planDef.tier];
    if (currentTierLevel > newTierLevel && currentSub?.status === "active") {
      return res.status(400).json({ message: "Cannot downgrade while active. Cancel first." });
    }

    const amount = planDef.pricing[billingCycle];
    if (!amount) return res.status(400).json({ message: "Invalid billing cycle" });

    const userInfo = await User.findById(userId);
    if (!userInfo) return res.status(404).json({ message: "User not found" });

    let customerId = currentSub?.razorpayCustomerId;
    if (!customerId) {
      const customer = await getRazorpay().customers.create({
        name: userInfo.name || userInfo.email, email: userInfo.email,
      });
      customerId = customer.id;
    }

    const order = await getRazorpay().orders.create({
      amount, currency: "INR",
      receipt: "sub_" + userId + "_" + planDef.tier + "_" + Date.now(),
      notes: { userId, planId, billingCycle, tier: planDef.tier },
    });

    let sub = currentSub || new Subscription({ userId });
    sub.razorpayCustomerId = customerId;
    sub.razorpayOrderId = order.id;
    sub.plan = planDef.tier;
    sub.billingCycle = billingCycle;
    sub.amountPaid = amount / 100;
    sub.invoiceNumber = generateInvoiceNumber();
    await sub.save();

    await BillingHistory.create({
      userId, subscriptionId: sub._id, razorpayOrderId: order.id,
      invoiceNumber: sub.invoiceNumber, plan: planDef.tier, billingCycle,
      amount: amount / 100, currency: "INR", paymentStatus: "pending",
    });

    return res.status(200).json({
      orderId: order.id, razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      amount, plan: planDef.tier, billingCycle, invoiceNumber: sub.invoiceNumber,
    });
  } catch (error) {
    console.error("createOrder error:", error);
    return res.status(500).json({ message: "Failed to create order" });
  }
};

export const verifyPayment = async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !userId) {
    return res.status(400).json({ message: "Missing payment details" });
  }
  try {
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSig = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body).digest("hex");
    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed" });
    }
    const sub = await Subscription.findOne({ userId });
    if (!sub) return res.status(404).json({ message: "Subscription not found" });
    if (sub.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ message: "Order mismatch" });
    }
    const now = new Date();
    const expiry = calcExpiryDate(sub.billingCycle, now);
    sub.razorpayPaymentId = razorpay_payment_id;
    sub.status = "active";
    sub.paymentStatus = "captured";
    sub.startDate = now;
    sub.expiryDate = expiry;
    sub.nextRenewalDate = expiry;
    sub.cancelAtPeriodEnd = false;
    sub.autoRenew = true;
    await sub.save();

    await BillingHistory.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      { razorpayPaymentId, subscriptionId: sub._id, paymentStatus: "captured",
        paymentMethod: "razorpay", periodStart: now, periodEnd: expiry }
    );

    const userInfo = await User.findById(userId);
    const planDef = PLAN_MAP[sub.plan];
    if (userInfo) {
      sendSubscriptionConfirmation(userInfo, sub, planDef).catch(() => {});
    }

    return res.status(200).json({
      message: "Payment verified", plan: sub.plan, status: sub.status,
      expiryDate: sub.expiryDate, billingCycle: sub.billingCycle,
    });
  } catch (error) {
    console.error("verifyPayment error:", error);
    return res.status(500).json({ message: "Verification failed" });
  }
};

export const cancelSubscription = async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: "userId is required" });
  try {
    const sub = await Subscription.findOne({ userId });
    if (!sub || sub.plan === "free") {
      return res.status(400).json({ message: "No active paid subscription" });
    }
    sub.cancelAtPeriodEnd = true;
    sub.cancelledAt = new Date();
    sub.autoRenew = false;
    sub.downgradeTo = "free";
    await sub.save();

    const cancelUser = await User.findById(userId);
    const cancelPlanDef = PLAN_MAP[sub.plan];
    if (cancelUser) {
      sendCancellationEmail(cancelUser, sub, cancelPlanDef).catch(() => {});
    }

    return res.status(200).json({ message: "Subscription will cancel at period end" });
  } catch (error) {
    console.error("cancelSubscription error:", error);
    return res.status(500).json({ message: "Failed to cancel" });
  }
};

export const reactivateSubscription = async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: "userId is required" });
  try {
    const sub = await Subscription.findOne({ userId });
    if (!sub) return res.status(404).json({ message: "No subscription found" });
    if (!sub.cancelAtPeriodEnd) {
      return res.status(400).json({ message: "Subscription is not cancelled" });
    }
    sub.cancelAtPeriodEnd = false;
    sub.cancelledAt = null;
    sub.autoRenew = true;
    sub.downgradeTo = sub.plan;
    await sub.save();
    return res.status(200).json({ message: "Subscription reactivated" });
  } catch (error) {
    console.error("reactivateSubscription error:", error);
    return res.status(500).json({ message: "Failed to reactivate" });
  }
};

export const getBillingHistory = async (req, res) => {
  const { userId } = req.params;
  try {
    const history = await BillingHistory.find({ userId }).sort({ createdAt: -1 }).limit(50);
    return res.status(200).json({ billingHistory: history });
  } catch (error) {
    console.error("getBillingHistory error:", error);
    return res.status(500).json({ message: "Failed to get billing history" });
  }
};

export const checkAccess = async (req, res) => {
  const { userId, feature } = req.params;
  try {
    const sub = await Subscription.findOne({ userId });
    const plan = sub?.plan || "free";
    const planDef = PLAN_MAP[plan] || PLAN_MAP.free;
    const features = planDef.features;
    let hasAccess = false;
    switch (feature) {
      case "premiumVideos": hasAccess = features.premiumVideos; break;
      case "adFree": hasAccess = features.adFree; break;
      case "exclusiveCourses": hasAccess = features.exclusiveCourses; break;
      case "priorityAccess": hasAccess = features.priorityAccess; break;
      case "backgroundPlay": hasAccess = features.backgroundPlay; break;
      default: hasAccess = false;
    }
    return res.status(200).json({ hasAccess, plan, features });
  } catch (error) {
    console.error("checkAccess error:", error);
    return res.status(500).json({ message: "Failed to check access" });
  }
};

export const webhookHandler = async (req, res) => {
  const sig = req.headers["x-razorpay-signature"];
  const body = JSON.stringify(req.body);
  const expectedSig = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body).digest("hex");
  if (sig !== expectedSig) {
    return res.status(400).json({ message: "Invalid signature" });
  }
  const event = req.body;
  try {
    switch (event.event) {
      case "payment.captured": {
        const payment = event.payload?.payment?.entity;
        if (payment?.order_id) {
          await BillingHistory.findOneAndUpdate(
            { razorpayOrderId: payment.order_id },
            { paymentStatus: "captured", razorpayPaymentId: payment.id }
          );
        }
        break;
      }
      case "payment.failed": {
        const payment = event.payload?.payment?.entity;
        if (payment?.order_id) {
          await BillingHistory.findOneAndUpdate(
            { razorpayOrderId: payment.order_id },
            { paymentStatus: "failed", failureReason: payment.error_description }
          );
        }
        break;
      }
      case "subscription.cancelled": {
        const sub = event.payload?.subscription?.entity;
        if (sub?.id) {
          await Subscription.findOneAndUpdate(
            { razorpaySubscriptionId: sub.id },
            { cancelAtPeriodEnd: true, autoRenew: false, downgradeTo: "free" }
          );
        }
        break;
      }
      case "subscription.expired": {
        const sub = event.payload?.subscription?.entity;
        if (sub?.id) {
          await Subscription.findOneAndUpdate(
            { razorpaySubscriptionId: sub.id },
            { plan: "free", status: "expired" }
          );
        }
        break;
      }
    }
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("webhookHandler error:", error);
    return res.status(500).json({ message: "Webhook processing failed" });
  }
};

export function autoExpireSubscriptions() {
  return async () => {
    try {
      const expired = await Subscription.find({
        plan: { $ne: "free" },
        expiryDate: { $lt: new Date() },
      });
      for (const sub of expired) {
        sub.plan = "free";
        sub.status = "expired";
        sub.paymentStatus = "pending";
        await sub.save();
        console.log("Auto-expired subscription for user:", sub.userId);
      }
    } catch (error) {
      console.error("autoExpire error:", error);
    }
  };
}