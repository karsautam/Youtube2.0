"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  G_PAGE_MAP,
  GLOBAL_SHORTCUTS,
  MOUSE_INTERACTIONS,
  PLAYER_SHORTCUTS,
  SINGLE_KEY_MAP,
} from "@/lib/shortcuts";

const IGNORE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);
const G_KEY_TIMEOUT = 1500;

function ShortcutKey({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((key, i) => (
        <span key={key} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-muted-foreground">then</span>}
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground shadow-sm">
            {key}
          </kbd>
        </span>
      ))}
    </span>
  );
}

function ShortcutRow({ row }: { row: { keys: string[]; label: string } }) {
  return (
    <li className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-sm text-foreground">{row.label}</span>
      <ShortcutKey keys={row.keys} />
    </li>
  );
}

function ShortcutSection({ title, rows }: { title: string; rows: { keys: string[]; label: string }[] }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      <ul>
        {rows.map((row) => (
          <ShortcutRow key={`${row.keys.join("+")}-${row.label}`} row={row} />
        ))}
      </ul>
    </div>
  );
}

export default function KeyboardShortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const gKeyRef = useRef(false);
  const gKeyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const isMeetPage = router.pathname.startsWith("/meeting");
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.metaKey || e.ctrlKey) return;
      if (helpOpen) return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (IGNORE_TAGS.has(target.tagName) || target.isContentEditable)
      ) {
        return;
      }

      if (isMeetPage) return;

      if (e.shiftKey && e.key === "/") {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }

      const key = e.key.toLowerCase();

      if (key === "/") {
        e.preventDefault();
        const input = document.getElementById(
          "global-search-input"
        ) as HTMLInputElement | null;
        input?.focus();
        input?.select();
        return;
      }

      if (key === "g" && !gKeyRef.current) {
        gKeyRef.current = true;
        if (gKeyTimerRef.current) clearTimeout(gKeyTimerRef.current);
        gKeyTimerRef.current = setTimeout(() => {
          gKeyRef.current = false;
        }, G_KEY_TIMEOUT);
        return;
      }

      if (gKeyRef.current) {
        if (gKeyTimerRef.current) clearTimeout(gKeyTimerRef.current);
        gKeyRef.current = false;
        const page = G_PAGE_MAP[key];
        if (page) {
          e.preventDefault();
          void router.push(page);
        }
        return;
      }

      const page = SINGLE_KEY_MAP[key];
      if (page) {
        e.preventDefault();
        void router.push(page);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [helpOpen, router]);

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts &amp; mouse interactions</DialogTitle>
          <DialogDescription>
            Shortcuts are ignored while typing in a field. Player shortcuts
            apply when the player is focused.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <ShortcutSection title="Global navigation" rows={GLOBAL_SHORTCUTS} />
          <ShortcutSection title="Player" rows={PLAYER_SHORTCUTS} />
          <ShortcutSection title="Mouse interactions" rows={MOUSE_INTERACTIONS} />
          <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            Videos automatically resume from where you left off, and are marked
            as completed once you've watched 90% (configurable via the{" "}
            <code className="rounded bg-muted px-1">watchCompletionThreshold</code>{" "}
            setting).
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
