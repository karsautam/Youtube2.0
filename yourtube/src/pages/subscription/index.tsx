import React, { useEffect, useState } from "react";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import { Check, X, Crown, ChevronDown, ChevronUp, Download, Play, Shield, Zap, Clock, CreditCard, Receipt, AlertCircle } from "lucide-react";
import Script from "next/script";
import { toast } from "sonner";

interface PlanFeature {
  premiumVideos: boolean;
  maxVideoQuality: string;
  offlineDownloads: number;
  adFree: boolean;
  priorityAccess: boolean;
  exclusiveCourses: boolean;
  backgroundPlay: boolean;
  maxWatchTimeMinutes: number;
  maxDailyDownloads: number;
  streamingSpeed: string;
  devicesSimultaneous: number;
  customerSupport: string;
}

interface Plan {
  id: string;
  tier: string;
  name: string;
  pricing: { monthly: number; quarterly: number; yearly: number };
  description: string;
  features: PlanFeature;
  badge: string;
  color: string;
}

interface SubStatus {
  plan: string;
  status: string;
  features: PlanFeature;
  billingCycle: string | null;
  startDate: string | null;
  expiryDate: string | null;
  nextRenewalDate: string | null;
  cancelAtPeriodEnd: boolean;
  daysRemaining: number | null;
  autoRenew: boolean;
  invoiceNumber: string | null;
  amountPaid: number | null;
  razorpayPaymentId: string | null;
}

interface BillingEntry {
  _id: string;
  plan: string;
  billingCycle: string;
  amount: number;
  currency: string;
  paymentStatus: string;
  invoiceNumber: string;
  createdAt: string;
  razorpayPaymentId: string;
  periodStart: string;
  periodEnd: string;
}

const CYCLE_LABELS: Record<string, string> = { monthly: "Monthly", quarterly: "Quarterly (3 mo)", yearly: "Yearly" };

const featureLabels: Record<string, string> = {
  premiumVideos: "Premium Videos",
  maxVideoQuality: "Max Video Quality",
  offlineDownloads: "Offline Downloads",
  adFree: "Ad-Free",
  priorityAccess: "Priority Access",
  exclusiveCourses: "Exclusive Courses",
  backgroundPlay: "Background Play",
  maxWatchTimeMinutes: "Daily Watch Limit",
  maxDailyDownloads: "Daily Downloads",
  streamingSpeed: "Streaming Speed",
  devicesSimultaneous: "Simultaneous Devices",
  customerSupport: "Customer Support",
};

function formatFeatureValue(key: string, val: any): string {
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (key === "offlineDownloads" || key === "maxDailyDownloads") return val === -1 ? "Unlimited" : val.toString();
  if (key === "maxWatchTimeMinutes") return val === -1 ? "Unlimited" : val + " min/day";
  if (key === "devicesSimultaneous") return val + " device" + (val > 1 ? "s" : "");
  if (key === "streamingSpeed") return val.charAt(0).toUpperCase() + val.slice(1);
  if (key === "customerSupport") return val.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  return String(val);
}

function formatPrice(paise: number): string {
  if (paise === 0) return "Free";
  return "\u20B9" + (paise / 100).toLocaleString("en-IN");
}

function formatCurrency(amount: number): string {
  return "\u20B9" + amount.toLocaleString("en-IN");
}

export default function SubscriptionPage() {
  const { user } = useUser();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subStatus, setSubStatus] = useState<SubStatus | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCycle, setSelectedCycle] = useState<string>("monthly");
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [showBilling, setShowBilling] = useState(false);
  const [activeTab, setActiveTab] = useState<"plans" | "dashboard">("plans");

  useEffect(() => {
    const load = async () => {
      try {
        const [plansRes, statusRes] = await Promise.all([
          axiosInstance.get("/subscription/plans"),
          user?._id
            ? axiosInstance.get("/subscription/status/" + user._id)
            : Promise.resolve({ data: { plan: "free", status: "active", features: {} } }),
        ]);
        setPlans(plansRes.data.plans);
        setSubStatus(statusRes.data);
        if (user?._id) {
          const billingRes = await axiosInstance.get("/subscription/billing/" + user._id);
          setBillingHistory(billingRes.data.billingHistory || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const handleSubscribe = async (planId: string) => {
    if (!user?._id) { toast.error("Please sign in"); return; }
    setSubscribing(planId);
    try {
      const { data } = await axiosInstance.post("/subscription/create-order", {
        userId: user._id, planId, billingCycle: selectedCycle,
      });
      if (!data.orderId) {
        toast.success(data.message || "Switched to " + data.plan + " plan");
        const res = await axiosInstance.get("/subscription/status/" + user._id);
        setSubStatus(res.data);
        setActiveTab("dashboard");
        setSubscribing(null);
        return;
      }
      const options = {
        key: data.razorpayKeyId, amount: data.amount, currency: "INR",
        name: "YourTube", description: data.plan.toUpperCase() + " - " + CYCLE_LABELS[data.billingCycle],
        order_id: data.orderId,
        handler: async (response: any) => {
          try {
            const verifyRes = await axiosInstance.post("/subscription/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              userId: user._id,
            });
            toast.success("Payment successful! " + verifyRes.data.plan.toUpperCase() + " plan activated.");
            const res = await axiosInstance.get("/subscription/status/" + user._id);
            setSubStatus(res.data);
            const billingRes = await axiosInstance.get("/subscription/billing/" + user._id);
            setBillingHistory(billingRes.data.billingHistory || []);
            setActiveTab("dashboard");
          } catch { toast.error("Payment verification failed. Contact support."); }
        },
        prefill: { name: user.name || "", email: user.email || "" },
        theme: { color: "#f59e0b" },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", (resp: any) => {
        toast.error("Payment failed: " + (resp?.error?.description || "Please try again."));
        axiosInstance.post("/subscription/billing/" + user._id + "/fail", { orderId: data.orderId }).catch(() => {});
      });
      rzp.open();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to start payment");
    } finally { setSubscribing(null); }
  };

  const handleCancel = async () => {
    if (!user?._id) return;
    try {
      await axiosInstance.post("/subscription/cancel", { userId: user._id });
      toast.success("Subscription will cancel at period end");
      const res = await axiosInstance.get("/subscription/status/" + user._id);
      setSubStatus(res.data);
    } catch { toast.error("Failed to cancel"); }
  };

  const handleReactivate = async () => {
    if (!user?._id) return;
    try {
      await axiosInstance.post("/subscription/reactivate", { userId: user._id });
      toast.success("Subscription reactivated");
      const res = await axiosInstance.get("/subscription/status/" + user._id);
      setSubStatus(res.data);
    } catch { toast.error("Failed to reactivate"); }
  };

  if (loading) {
    return <main className="flex-1 p-6"><div className="max-w-6xl mx-auto text-center py-20 text-muted-foreground">Loading...</div></main>;
  }

  const currentPlanTier = subStatus?.plan || "free";
  const paidPlans = plans.filter((p) => p.tier !== "free");
  const freePlan = plans.find((p) => p.tier === "free");
  const currentPlanDef = plans.find((p) => p.tier === currentPlanTier) || freePlan;
  const isPaid = currentPlanTier !== "free";

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      <main className="flex-1 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Crown className="w-8 h-8 text-amber-500" />
            <h1 className="text-3xl font-bold">YourTube Membership</h1>
          </div>
          <p className="text-muted-foreground text-center mb-6">Choose the plan that fits you best</p>

          <div className="flex justify-center gap-2 mb-8">
            <button onClick={() => setActiveTab("plans")} className={"px-6 py-2 rounded-full font-medium text-sm transition " + (activeTab === "plans" ? "bg-black text-white" : "bg-muted text-muted-foreground hover:bg-accent")}>Plans</button>
            <button onClick={() => setActiveTab("dashboard")} className={"px-6 py-2 rounded-full font-medium text-sm transition " + (activeTab === "dashboard" ? "bg-black text-white" : "bg-muted text-muted-foreground hover:bg-accent")}>My Subscription</button>
          </div>

          {activeTab === "plans" && (
            <>
              <div className="flex justify-center mb-8">
                <div className="inline-flex bg-muted rounded-full p-1">
                  {["monthly", "quarterly", "yearly"].map((cycle) => (
                    <button key={cycle} onClick={() => setSelectedCycle(cycle)}
                      className={"px-5 py-2 rounded-full text-sm font-medium transition " + (selectedCycle === cycle ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}>
                      {CYCLE_LABELS[cycle]}
                      {cycle === "yearly" && <span className="ml-1 text-xs text-green-600 font-bold">Save 33%</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
                {freePlan && (
                  <PlanCard plan={freePlan} cycle={selectedCycle} isCurrent={currentPlanTier === "free"} isPaid={isPaid}
                    onSelect={() => handleSubscribe("free")} subscribing={subscribing === "free"} />
                )}
                {paidPlans.map((plan) => (
                  <PlanCard key={plan.tier} plan={plan} cycle={selectedCycle} isCurrent={currentPlanTier === plan.tier} isPaid={isPaid}
                    isPopular={plan.tier === "silver"} onSelect={() => handleSubscribe(plan.tier)} subscribing={subscribing === plan.tier} />
                ))}
              </div>

              <button onClick={() => setShowComparison(!showComparison)}
                className="flex items-center gap-2 mx-auto text-sm font-medium text-muted-foreground hover:text-foreground mb-4">
                Compare all features {showComparison ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showComparison && <ComparisonTable plans={plans} cycle={selectedCycle} />}
            </>
          )}

          {activeTab === "dashboard" && subStatus && (
            <Dashboard
              status={subStatus} plans={plans} billingHistory={billingHistory}
              onCancel={handleCancel} onReactivate={handleReactivate} onUpgrade={(tier) => { setActiveTab("plans"); }}
            />
          )}
        </div>
      </main>
    </>
  );
}

function PlanCard({ plan, cycle, isCurrent, isPaid, isPopular, onSelect, subscribing }: {
  plan: Plan; cycle: string; isCurrent: boolean; isPaid: boolean; isPopular?: boolean;
  onSelect: () => void; subscribing: boolean;
}) {
  const price = plan.pricing[cycle as keyof typeof plan.pricing] || 0;
  const yearlySavings = plan.pricing.monthly > 0 ? (plan.pricing.monthly * 12 - plan.pricing.yearly) / 100 : 0;
  return (
    <div className={"relative rounded-2xl border-2 p-6 flex flex-col transition-all " + (isPopular ? "border-amber-400 shadow-lg shadow-amber-100" : "border-border hover:border-border")}>
      {isPopular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs font-bold px-4 py-1 rounded-full">Most Popular</div>}
      {plan.tier === "free" && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-muted0 text-white text-xs font-bold px-4 py-1 rounded-full">Free</div>}
      <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: plan.color + "20" }}>
        <Crown className="w-5 h-5" style={{ color: plan.color }} />
      </div>
      <h3 className="text-xl font-bold">{plan.name}</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">{plan.description}</p>
      <div className="mb-5">
        <span className="text-3xl font-extrabold">{formatPrice(price)}</span>
        {price > 0 && <span className="text-muted-foreground text-sm">/{cycle === "yearly" ? "year" : cycle === "quarterly" ? "quarter" : "month"}</span>}
      </div>
      {plan.tier === "free" ? null : (
        <div className="space-y-1.5 mb-5 text-xs">
          <div className="flex justify-between"><span className="text-muted-foreground">Monthly</span><span className="font-medium">{formatPrice(plan.pricing.monthly)}/mo</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Quarterly</span><span className="font-medium">{formatPrice(plan.pricing.quarterly)}/qtr</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Yearly</span><span className="font-medium text-green-600">{formatPrice(plan.pricing.yearly)}/yr</span></div>
        </div>
      )}
      <ul className="space-y-2 mb-6 flex-1">
        <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500 shrink-0" />{plan.features.maxVideoQuality} streaming</li>
        <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500 shrink-0" />{plan.features.adFree ? "Ad-free" : "With ads"}</li>
        <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500 shrink-0" />{plan.features.offlineDownloads === -1 ? "Unlimited" : plan.features.offlineDownloads} downloads</li>
        <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500 shrink-0" />{plan.features.devicesSimultaneous} device(s)</li>
        {plan.features.exclusiveCourses && <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500 shrink-0" />Exclusive courses</li>}
        {plan.features.priorityAccess && <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500 shrink-0" />Priority access</li>}
      </ul>
      <button onClick={onSelect} disabled={isCurrent || subscribing}
        className={"w-full py-3 rounded-full font-semibold text-sm transition " + (isCurrent ? "bg-muted text-muted-foreground cursor-default" : isPopular ? "bg-red-600 text-white hover:bg-red-700" : plan.tier === "free" ? "bg-muted text-foreground hover:bg-muted-foreground/30" : "bg-primary text-primary-foreground hover:bg-primary/90")}>
        {isCurrent ? "Current Plan" : subscribing ? "Processing..." : plan.tier === "free" ? "Get Started" : "Subscribe"}
      </button>
    </div>
  );
}

function ComparisonTable({ plans, cycle }: { plans: Plan[]; cycle: string }) {
  const keys = Object.keys(featureLabels) as Array<keyof typeof featureLabels>;
  return (
    <div className="overflow-x-auto mb-10">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Feature</th>
            {plans.map((p) => <th key={p.tier} className="text-center py-3 px-4 font-bold">{p.name}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b bg-muted">
            <td className="py-3 px-4 font-medium">Price ({cycle})</td>
            {plans.map((p) => <td key={p.tier} className="text-center py-3 px-4 font-semibold">{formatPrice(p.pricing[cycle as keyof typeof p.pricing])}</td>)}
          </tr>
          {keys.map((key) => (
            <tr key={key} className="border-b hover:bg-muted">
              <td className="py-3 px-4 text-foreground">{featureLabels[key]}</td>
              {plans.map((p) => {
                const val = (p.features as any)[key];
                const isBool = typeof val === "boolean";
                return (
                  <td key={p.tier} className="text-center py-3 px-4">
                    {isBool ? (val ? <Check className="w-5 h-5 text-green-500 mx-auto" /> : <X className="w-5 h-5 text-muted-foreground/50 mx-auto" />) : <span className="font-medium">{formatFeatureValue(key, val)}</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Dashboard({ status, plans, billingHistory, onCancel, onReactivate, onUpgrade }: {
  status: SubStatus; plans: Plan[]; billingHistory: BillingEntry[];
  onCancel: () => void; onReactivate: () => void; onUpgrade: (tier: string) => void;
}) {
  const planDef = plans.find((p) => p.tier === status.plan);
  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "N/A";
  const statusColor = status.cancelAtPeriodEnd ? "text-orange-500" : status.plan === "free" ? "text-muted-foreground" : "text-green-600";
  const statusText = status.cancelAtPeriodEnd ? "Cancels at period end" : status.plan === "free" ? "Free Plan" : "Active";
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border p-6" style={{ borderColor: planDef?.color || "#e5e7eb" }}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: (planDef?.color || "#6b7280") + "20" }}>
                <Crown className="w-6 h-6" style={{ color: planDef?.color || "#6b7280" }} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{status.plan.toUpperCase()} Plan</h2>
                <p className={"text-sm font-medium " + statusColor}>{statusText}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {status.plan !== "free" && !status.cancelAtPeriodEnd && (
              <button onClick={onCancel} className="px-4 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition">Cancel Plan</button>
            )}
            {status.cancelAtPeriodEnd && (
              <button onClick={onReactivate} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition">Reactivate</button>
            )}
            <button onClick={() => onUpgrade(status.plan)} className="px-4 py-2 text-sm bg-foreground text-background rounded-lg hover:bg-foreground/90 transition">
              {status.plan === "free" ? "Upgrade" : "Change Plan"}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-muted rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Billing Cycle</p>
            <p className="font-semibold">{status.billingCycle ? CYCLE_LABELS[status.billingCycle] : "N/A"}</p>
          </div>
          <div className="bg-muted rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Start Date</p>
            <p className="font-semibold">{formatDate(status.startDate)}</p>
          </div>
          <div className="bg-muted rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Expiry / Renewal</p>
            <p className="font-semibold">{formatDate(status.expiryDate)}</p>
            {status.daysRemaining !== null && status.daysRemaining > 0 && <p className="text-xs text-muted-foreground mt-0.5">{status.daysRemaining} days left</p>}
          </div>
          <div className="bg-muted rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Amount Paid</p>
            <p className="font-semibold">{status.amountPaid ? formatCurrency(status.amountPaid) : "Free"}</p>
          </div>
        </div>
        {status.invoiceNumber && (
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Receipt className="w-3 h-3" />{status.invoiceNumber}</span>
            {status.razorpayPaymentId && <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" />{status.razorpayPaymentId}</span>}
          </div>
        )}
      </div>

      <div className="rounded-2xl border p-6">
        <h3 className="font-bold text-lg mb-4">Your Features</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(status.features || {}).map(([key, val]) => (
            <div key={key} className="flex items-center gap-2 text-sm">
              {typeof val === "boolean" ? (val ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-muted-foreground/50" />) : <Check className="w-4 h-4 text-green-500" />}
              <span className={typeof val === "boolean" && !val ? "text-muted-foreground" : ""}>{featureLabels[key] || key}: <span className="font-medium">{formatFeatureValue(key, val)}</span></span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border p-6">
        <button onClick={() => {}} className="flex items-center justify-between w-full">
          <h3 className="font-bold text-lg">Billing History</h3>
          <span className="text-sm text-muted-foreground">{billingHistory.length} transaction(s)</span>
        </button>
        {billingHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-4">No billing history yet</p>
        ) : (
          <div className="mt-4 space-y-2">
            {billingHistory.map((entry) => (
              <div key={entry._id} className="flex items-center justify-between py-3 border-b last:border-0">
                <div>
                  <p className="font-medium text-sm">{entry.plan.toUpperCase()} - {CYCLE_LABELS[entry.billingCycle] || entry.billingCycle}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}{entry.invoiceNumber ? " | " + entry.invoiceNumber : ""}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">{formatCurrency(entry.amount)}</p>
                  <p className={"text-xs " + (entry.paymentStatus === "captured" ? "text-green-600" : entry.paymentStatus === "failed" ? "text-red-500" : "text-orange-500")}>
                    {entry.paymentStatus.charAt(0).toUpperCase() + entry.paymentStatus.slice(1)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}