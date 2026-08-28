import {
  Home,
  Clock,
  ThumbsUp,
  History,
  User,
  Crown,
  Download,
  X,
  PlaySquare,
  Zap,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { Button } from "./ui/button";
import Channeldialogue from "./channeldialogue";
import { useUser } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useRouter } from "next/router";

const NO_HOVER = "transition-all duration-200 hover:bg-accent hover:shadow-sm hover:scale-[1.02] active:bg-accent active:scale-[0.98] active:shadow-inner";

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

const Sidebar = ({ open = false, onClose }: SidebarProps) => {
  const { user } = useUser();
  const router = useRouter();
  const [isdialogeopen, setisdialogeopen] = useState(false);

  useEffect(() => {
    const close = () => onClose?.();
    router.events.on("routeChangeComplete", close);
    return () => {
      router.events.off("routeChangeComplete", close);
    };
  }, [router, onClose]);

  const isActive = (href: string) =>
    href === "/" ? router.pathname === "/" : router.pathname.startsWith(href);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-30"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "fixed left-0 top-14 bottom-0 z-40 w-64 overflow-y-auto bg-background border-r p-2 transition-transform duration-200 ease-in-out lg:top-23",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="mb-1 px-2 pt-2 pb-3" />
        <nav className="space-y-1">
          <Link href="/" onClick={(e) => { if (isActive("/")) e.preventDefault(); }}>
            <Button
              variant="ghost"
              className={cn(
                `w-full justify-start ${NO_HOVER}`,
                isActive("/") && "bg-accent font-semibold"
              )}
            >
              <Home className="w-5 h-5 mr-3" />
              Home
            </Button>
          </Link>
          <Link href="/shorts">
            <Button
              variant="ghost"
              className={cn(
                `w-full justify-start ${NO_HOVER}`,
                isActive("/shorts") && "bg-accent font-semibold"
              )}
            >
              <Zap className="w-5 h-5 mr-3" />
              Shorts
            </Button>
          </Link>
          <Link href="/subscriptions">
            <Button
              variant="ghost"
              className={cn(
                `w-full justify-start ${NO_HOVER}`,
                isActive("/subscriptions") && "bg-accent font-semibold"
              )}
            >
              <PlaySquare className="w-5 h-5 mr-3" />
              Subscriptions
            </Button>
          </Link>

          {user && (
            <>
              <div className="border-t pt-2 mt-2">
                <Link href="/history">
                  <Button
                    variant="ghost"
                    className={cn(
                      `w-full justify-start ${NO_HOVER}`,
                      isActive("/history") && "bg-accent font-semibold"
                    )}
                  >
                    <History className="w-5 h-5 mr-3" />
                    History
                  </Button>
                </Link>
                <Link href="/liked">
                  <Button
                    variant="ghost"
                    className={cn(
                      `w-full justify-start ${NO_HOVER}`,
                      isActive("/liked") && "bg-accent font-semibold"
                    )}
                  >
                    <ThumbsUp className="w-5 h-5 mr-3" />
                    Liked videos
                  </Button>
                </Link>
                <Link href="/watch-later">
                  <Button
                    variant="ghost"
                    className={cn(
                      `w-full justify-start ${NO_HOVER}`,
                      isActive("/watch-later") && "bg-accent font-semibold"
                    )}
                  >
                    <Clock className="w-5 h-5 mr-3" />
                    Watch later
                  </Button>
                </Link>
                <Link href="/downloads">
                  <Button
                    variant="ghost"
                    className={cn(
                      `w-full justify-start ${NO_HOVER}`,
                      isActive("/downloads") && "bg-accent font-semibold"
                    )}
                  >
                    <Download className="w-5 h-5 mr-3" />
                    Downloads
                  </Button>
                </Link>
              </div>
              <div className="border-t pt-2 mt-2">
                {user?.channelname ? (
                  <Link href={`/channel/${user._id}`}>
                    <Button
                      variant="ghost"
                      className={cn(
                        `w-full justify-start ${NO_HOVER}`,
                        isActive("/channel") && "bg-accent font-semibold"
                      )}
                    >
                      <User className="w-5 h-5 mr-3" />
                      Your channel
                    </Button>
                  </Link>
                ) : (
                  <div className="px-2 py-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => setisdialogeopen(true)}
                    >
                      Create Channel
                    </Button>
                  </div>
                )}
                <Link href="/subscription">
                  <Button
                    variant="ghost"
                    className={cn(
                      `w-full justify-start ${NO_HOVER}`,
                      isActive("/subscription") && "bg-accent font-semibold"
                    )}
                  >
                    <Crown className="w-5 h-5 mr-3" />
                    Membership
                  </Button>
                </Link>
              </div>
            </>
          )}
          {!user && (
            <div className="border-t pt-2 mt-2 px-2">
              <p className="text-sm text-muted-foreground mb-2">
                Sign in to like videos, comment, and subscribe.
              </p>
            </div>
          )}
        </nav>
        <Channeldialogue
          isopen={isdialogeopen}
          onclose={() => setisdialogeopen(false)}
          mode="create"
        />
      </aside>
    </>
  );
};

export default Sidebar;
