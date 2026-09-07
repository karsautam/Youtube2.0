import { useState } from "react";
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
  const [code, setCode] = useState(otpDevCode || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

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
      if (data?.devCode) {
        setCode(data.devCode);
        setError("Email failed — code shown above.");
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
        className="sm:max-w-md"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            Verify this device
          </DialogTitle>
          <DialogDescription>
            {otpDevCode ? (
              <>
                Your account was used from another device recently. We couldn&apos;t deliver the
                verification email, so use the code shown below to finish signing in.
              </>
            ) : (
              <>
                Your account was used from another device recently. We&apos;ve sent a verification
                code to <span className="font-medium text-foreground">{otpEmail}</span>. Enter it
                below to finish signing in on this device.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {otpDevCode && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-center">
              <p className="text-xs text-amber-700">Email not delivered — your code is:</p>
              <p className="mt-1 text-2xl font-bold tracking-[0.35em] text-amber-900">{otpDevCode}</p>
            </div>
          )}
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter 6-digit code"
            inputMode="numeric"
            autoFocus
            maxLength={6}
            className="tracking-[0.3em] text-center text-lg font-semibold"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">
            The code expires in 10 minutes. It will not be accepted from any
            other device.
          </p>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <Button
            variant="link"
            size="sm"
            onClick={handleResend}
            disabled={resending}
            className="px-0"
          >
            {resending ? "Resending..." : "Resend code"}
          </Button>
          <Button onClick={handleVerify} disabled={loading || !code.trim()}>
            {loading ? "Verifying..." : "Verify"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}