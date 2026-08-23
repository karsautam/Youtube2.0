import mongoose from "mongoose";

const billingHistorySchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "subscription",
    },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySubscriptionId: { type: String },
    invoiceNumber: { type: String },
    plan: {
      type: String,
      enum: ["free", "bronze", "silver", "gold"],
      required: true,
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "quarterly", "yearly"],
      required: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    paymentStatus: {
      type: String,
      enum: ["pending", "captured", "failed", "refunded"],
      default: "pending",
    },
    paymentMethod: { type: String },
    failureReason: { type: String },
    periodStart: { type: Date },
    periodEnd: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("billinghistory", billingHistorySchema);
