import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMeetLink } from "@/lib/meet/api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  passcode: string;
};

export default function InviteDialog({
  open,
  onOpenChange,
  roomId,
  passcode,
}: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const link = getMeetLink(roomId);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dark bg-slate-900 text-white">
        <DialogHeader>
          <DialogTitle>Invite people</DialogTitle>
          <DialogDescription>
            Share this link or meeting code to let people join.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="mb-1 text-sm font-medium">Meeting link</p>
            <div className="flex gap-2">
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 flex-1 items-center truncate text-blue-400 underline"
              >
                {link}
              </a>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copy(link, "link")}
              >
                {copied === "link" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">Meeting code</p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={roomId}
                className="flex-1 font-mono tracking-widest bg-white/10 text-white focus-visible:ring-blue-500"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copy(roomId, "code")}
              >
                {copied === "code" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          {passcode ? (
            <div>
              <p className="mb-1 text-sm font-medium">
                Meeting passcode (required to join)
              </p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={passcode}
                  className="flex-1 font-mono tracking-widest bg-white/10 text-white focus-visible:ring-blue-500"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copy(passcode, "pass")}
                >
                  {copied === "pass" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
