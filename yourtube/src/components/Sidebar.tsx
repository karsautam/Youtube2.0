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
} from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import { Button } from "./ui/button";
import Channeldialogue from "./channeldialogue";
import { useUser } from "@/lib/AuthContext";

const NO_HOVER = "transition-all duration-200 hover:bg-gray-100 hover:shadow-sm hover:scale-[1.02] active:bg-gray-200 active:scale-[0.98] active:shadow-inner";

const Sidebar = () => {
  const { user } = useUser();

  const [isdialogeopen, setisdialogeopen] = useState(false);
  return (
    <aside className="w-64 bg-white  border-r min-h-screen p-2">
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
  );
};

export default Sidebar;
