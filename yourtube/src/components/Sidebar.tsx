import {
  Home,
  Compass,
  PlaySquare,
  Clock,
  ThumbsUp,
  History,
  User,
  Crown,
  Download,
  X,
} from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import { Button } from "./ui/button";
import Channeldialogue from "./channeldialogue";
import { useUser } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

const NO_HOVER = "transition-all duration-200 hover:bg-accent hover:shadow-sm hover:scale-[1.02] active:bg-accent active:scale-[0.98] active:shadow-inner";

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
  desktopPersistent?: boolean;
}

const Sidebar = ({
  open = false,
  onClose,
  desktopPersistent = true,
}: SidebarProps) => {
  const { user } = useUser();

  const [isdialogeopen, setisdialogeopen] = useState(false);
  return (
    <>
      {open && (
        <div
          className={cn(
            "fixed inset-0 bg-black/50 z-30",
            desktopPersistent && "lg:hidden"
          )}
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "fixed left-0 top-14 bottom-0 z-40 w-64 overflow-y-auto bg-background border-r p-2 transition-transform duration-200 ease-in-out",
          desktopPersistent &&
            "lg:static lg:inset-auto lg:z-auto lg:min-h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="mb-2 flex items-center justify-between lg:hidden">
          <span className="px-2 text-sm font-semibold text-muted-foreground">Menu</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close menu"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        <nav className="space-y-1">
        <Link href="/">
          <Button variant="ghost" className={`w-full justify-start ${NO_HOVER}`}>
            <Home className="w-5 h-5 mr-3" />
            Home
          </Button>
        </Link>
        <Link href="/explore">
          <Button variant="ghost" className={`w-full justify-start ${NO_HOVER}`}>
            <Compass className="w-5 h-5 mr-3" />
            Explore
          </Button>
        </Link>
        <Link href="/subscriptions">
          <Button variant="ghost" className={`w-full justify-start ${NO_HOVER}`}>
            <PlaySquare className="w-5 h-5 mr-3" />
            Subscriptions
          </Button>
        </Link>

        {user && (
          <>
            <div className="border-t pt-2 mt-2">
              <Link href="/downloads">
                <Button
                  variant="ghost"
                  className={`w-full justify-start ${NO_HOVER}`}
                >
                  <Download className="w-5 h-5 mr-3" />
                  Downloads
                </Button>
              </Link>
              <Link href="/history">
                <Button
                  variant="ghost"
                  className={`w-full justify-start ${NO_HOVER}`}
                >
                  <History className="w-5 h-5 mr-3" />
                  History
                </Button>
              </Link>
              <Link href="/liked">
                <Button
                  variant="ghost"
                  className={`w-full justify-start ${NO_HOVER}`}
                >
                  <ThumbsUp className="w-5 h-5 mr-3" />
                  Liked videos
                </Button>
              </Link>
              <Link href="/watch-later">
                <Button
                  variant="ghost"
                  className={`w-full justify-start ${NO_HOVER}`}
                >
                  <Clock className="w-5 h-5 mr-3" />
                  Watch later
                </Button>
              </Link>
              {user?.channelname ? (
                <Link href={`/channel/${user._id}`}>
                  <Button
                    variant="ghost"
                    className={`w-full justify-start ${NO_HOVER}`}
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
                  className={`w-full justify-start ${NO_HOVER}`}
                >
                  <Crown className="w-5 h-5 mr-3" />
                  Subscription
                </Button>
              </Link>
            </div>
          </>
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
