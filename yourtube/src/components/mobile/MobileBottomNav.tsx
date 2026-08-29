import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, type ReactNode } from "react";
import {
  Clock,
  Compass,
  Crown,
  Download,
  History,
  Home,
  LogOut,
  PlaySquare,
  Plus,
  ThumbsUp,
  User,
  VideoIcon,
  X,
  Zap,
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

function NavButton({
  href,
  icon,
  label,
  active = false,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={(e) => {
        if (active) e.preventDefault();
      }}
      className={cn(
        "flex h-full flex-col items-center justify-center gap-0.5 px-1 transition-colors active:bg-accent",
        active ? "text-foreground" : "text-muted-foreground"
      )}
    >
      <span className={cn(active ? "text-foreground" : "text-muted-foreground")}>{icon}</span>
      <span
        className={cn(
          "text-[10px] leading-none",
          active ? "font-semibold" : "font-medium"
        )}
      >
        {label}
      </span>
    </Link>
  );
}

function SheetItem({
  href,
  icon,
  children,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent active:bg-accent"
    >
      <span className="text-muted-foreground">{icon}</span>
      {children}
    </Link>
  );
}

export default function MobileBottomNav({
  accountOpen,
  onAccountOpen,
}: {
  accountOpen: boolean;
  onAccountOpen: (open: boolean) => void;
}) {
  const router = useRouter();
  const { user, logout } = useUser();

  useEffect(() => {
    const close = () => onAccountOpen(false);
    router.events.on("routeChangeComplete", close);
    return () => {
      router.events.off("routeChangeComplete", close);
    };
  }, [router, onAccountOpen]);

  const isHome = router.pathname === "/";
  const isShorts = router.pathname.startsWith("/shorts");
  const isSubscriptions = router.pathname.startsWith("/subscriptions");
  const hideBottomBar = router.pathname.startsWith("/downloads");

  return (
    <>
      {/* Account sheet overlay */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/50 transition-opacity duration-200 lg:hidden",
          accountOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => onAccountOpen(false)}
        aria-hidden="true"
      />

      {/* Account sheet */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-80 max-w-[85vw] flex-col bg-background shadow-2xl transition-transform duration-200 ease-out lg:hidden",
          accountOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center gap-3 border-b px-4 py-4">
          {user ? (
            <>
              <Avatar key={user.image || "none"} className="h-10 w-10 shrink-0">
                <AvatarImage src={user.image} />
                <AvatarFallback>{user.name?.[0] || "U"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {user.name || "Your account"}
                </p>
                {user.channelname && (
                  <p className="truncate text-xs text-muted-foreground">
                    {user.channelname}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Manage your videos and more</p>
              <Button
                size="sm"
                className="mt-2 rounded-full"
                onClick={() => router.push("/signin")}
              >
                <User className="mr-1.5 h-4 w-4" />
                Log in
              </Button>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close menu"
            onClick={() => onAccountOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {user?.channelname && (
            <SheetItem href={`/channel/${user._id}`} icon={<User className="h-5 w-5" />}>
              Your channel
            </SheetItem>
          )}
          <SheetItem href="/history" icon={<History className="h-5 w-5" />}>
            History
          </SheetItem>
          <SheetItem href="/liked" icon={<ThumbsUp className="h-5 w-5" />}>
            Liked videos
          </SheetItem>
          <SheetItem href="/watch-later" icon={<Clock className="h-5 w-5" />}>
            Watch later
          </SheetItem>
          <SheetItem href="/downloads" icon={<Download className="h-5 w-5" />}>
            Downloads
          </SheetItem>
          <SheetItem href="/subscription" icon={<Crown className="h-5 w-5" />}>
            Subscription
          </SheetItem>
          <SheetItem href="/explore" icon={<Compass className="h-5 w-5" />}>
            Explore
          </SheetItem>
          <SheetItem href="/meeting" icon={<VideoIcon className="h-5 w-5" />}>
            Start a meeting
          </SheetItem>
          {user && (
            <>
              <div className="my-2 border-t" />
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-4 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent active:bg-accent"
              >
                <LogOut className="h-5 w-5 text-muted-foreground" />
                Sign out
              </button>
            </>
          )}
        </nav>
      </aside>

      {/* Bottom navigation */}
      {!hideBottomBar && (
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="relative grid h-16 grid-cols-5 items-stretch">
          <NavButton
            href="/"
            label="Home"
            active={isHome}
            icon={<Home className={cn("h-[22px] w-[22px]", isHome && "fill-current")} />}
          />
          <NavButton
            href="/shorts"
            label="Shorts"
            active={isShorts}
            icon={
              <Zap
                className={cn("h-[22px] w-[22px]", isShorts && "fill-current")}
              />
            }
          />
          <div aria-hidden="true" />
          <NavButton
            href="/subscriptions"
            label="Subscriptions"
            active={isSubscriptions}
            icon={
              <PlaySquare
                className={cn("h-[22px] w-[22px]", isSubscriptions && "fill-current")}
              />
            }
          />
          <button
            type="button"
            onClick={() => onAccountOpen(true)}
            className="flex h-full flex-col items-center justify-center gap-0.5 px-1 transition-colors active:bg-accent"
          >
            {user ? (
              <Avatar key={user.image || "none"} className="h-6 w-6">
                <AvatarImage src={user.image} />
                <AvatarFallback>{user.name?.[0] || "U"}</AvatarFallback>
              </Avatar>
            ) : (
              <User className="h-[22px] w-[22px] text-muted-foreground" />
            )}
            <span className="text-[10px] font-medium leading-none text-muted-foreground">
              You
            </span>
          </button>
          <button
            type="button"
            aria-label="Upload video"
            onClick={() => router.push("/upload")}
            className="absolute left-1/2 top-0 flex h-12 w-12 -translate-x-1/2 -translate-y-5 items-center justify-center rounded-full bg-red-600 text-white shadow-lg ring-4 ring-white transition-transform active:scale-95"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>
      </nav>
      )}
    </>
  );
}
