import { useEffect, useState } from "react";
import { useUser } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function OtpVerifyDialog() {
  const { pendingOtp, otpEmail, otpDevCode, verifyDeviceOtp, resendDeviceOtp } = useUser();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (pendingOtp) {
      setCode("");
      setError("");
      setCooldown(60);
    }
  }, [pendingOtp, otpDevCode]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  if (!pendingOtp) return null;

  const handleVerify = async () => {
    if (!code.trim()) {
      setError("Please enter the code from your email.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await verifyDeviceOtp(code.trim());
      if (!res.success) {
        setError("Verification failed. Please try again.");
      } else {
        toast.success(
          res.message || "Device verified. You're signed in."
        );
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || "Verification failed. Please try again.");
    } finally {
      setLoading(false);
      setCode("");
    }
  };

  const handleResend = async () => {
    setError("");
    setResending(true);
    try {
      const data = await resendDeviceOtp();
      setCooldown(60);
      if (data?.devCode) {
        setError("Use the verification code shown above (also check Spam/Promotions).");
      } else {
        toast.success(data?.message || "Code sent to your email.");
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not resend the code.");
    } finally {
      setResending(false);
    }
  };

  return (
    <Dialog open={pendingOtp} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md overflow-hidden p-0"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="border-b bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="flex items-center gap-2 text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <ShieldCheck className="h-4 w-4" />
              </span>
              Verify this device
            </DialogTitle>
            <DialogDescription className="text-blue-50">
              A new device is trying to sign in
              {otpEmail ? (
                <> to <span className="font-medium text-white">{otpEmail}</span></>
              ) : null}
              . Enter the 6-digit code to continue.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          {otpDevCode ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-center dark:border-blue-900 dark:bg-blue-950/30">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                Your verification code
              </p>
              <p className="mt-2 text-3xl font-bold tracking-[0.35em] text-blue-900 dark:text-blue-100">
                {otpDevCode}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                We also sent this to your email. If you don&apos;t see it, check your{" "}
                <span className="font-medium text-foreground">Spam</span> or{" "}
                <span className="font-medium text-foreground">Promotions</span> folder.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border bg-muted/30 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                We sent a 6-digit code to{" "}
                <span className="font-medium text-foreground">{otpEmail}</span>.
                If it doesn&apos;t arrive, check Spam/Promotions.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="• • • • • •"
              inputMode="numeric"
              autoFocus
              maxLength={6}
              className="h-12 text-center text-xl font-semibold tracking-[0.4em]"
            />
            {error && (
              <p className="text-center text-sm text-destructive">{error}</p>
            )}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Expires in 10 minutes • Only valid for this device
          </p>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 border-t bg-muted/20 px-6 py-4 sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResend}
            disabled={resending || cooldown > 0}
          >
            {resending
              ? "Resending..."
              : cooldown > 0
                ? `Resend in ${cooldown}s`
                : "Resend code"}
          </Button>
          <Button
            onClick={handleVerify}
            disabled={loading || code.trim().length < 6}
            className="min-w-28"
          >
            {loading ? "Verifying..." : "Verify & sign in"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}