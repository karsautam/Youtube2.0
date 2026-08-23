import mongoose from "mongoose";

const subscriptionSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      unique: true,
    },
    razorpayCustomerId: { type: String },
    plan: {
      type: String,
      enum: ["free", "bronze", "silver", "gold"],
      default: "free",
    },
    status: {
      type: String,
      enum: ["active", "expired", "cancelled", "past_due"],
      default: "active",
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "quarterly", "yearly"],
      default: "monthly",
    },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySubscriptionId: { type: String },
    razorpayPlanId: { type: String },
    invoiceNumber: { type: String },
    amountPaid: { type: Number, default: 0 },
    currency: { type: String, default: "INR" },
    startDate: { type: Date },
    expiryDate: { type: Date },
    nextRenewalDate: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    cancelledAt: { type: Date },
    paymentStatus: {
      type: String,
      enum: ["pending", "captured", "failed", "refunded"],
      default: "pending",
    },
    autoRenew: { type: Boolean, default: true },
    downgradeTo: {
      type: String,
      enum: ["free", "bronze", "silver", "gold"],
      default: "free",
    },
  },
  { timestamps: true }
);

export default mongoose.model("subscription", subscriptionSchema);
