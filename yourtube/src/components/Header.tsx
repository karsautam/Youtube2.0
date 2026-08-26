import {
  ArrowLeft,
  Bell,
  Menu,
  Mic,
  Search,
  User,
  Upload,
  VideoIcon,
} from "lucide-react";
import React, { useState } from "react";
import { Button } from "./ui/button";
import Link from "next/link";
import { Input } from "./ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import Channeldialogue from "./channeldialogue";
import { useRouter } from "next/router";
import { useUser } from "@/lib/AuthContext";

const Header = ({ onMenuToggle }: { onMenuToggle?: () => void }) => {
  const { user, logout } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [isdialogeopen, setisdialogeopen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const router = useRouter();
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };
  const handleKeypress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch(e as any);
    }
  };
  return (
    <header className="sticky top-9 z-50 flex items-center px-2 py-2 bg-background border-b sm:px-4">
      {mobileSearchOpen ? (
        <form
          onSubmit={handleSearch}
          className="flex w-full items-center gap-1 md:hidden"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close search"
            onClick={() => setMobileSearchOpen(false)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Input
            autoFocus
            type="search"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 rounded-full focus-visible:ring-0"
          />
          <Button type="submit" variant="ghost" size="icon" aria-label="Search">
            <Search className="w-5 h-5" />
          </Button>
        </form>
      ) : (
        <div className="flex w-full items-center gap-2 sm:gap-4">
          <div className="flex shrink-0 items-center gap-1 sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle menu"
              onClick={onMenuToggle}
              className="transition-all duration-200 hover:bg-accent hover:shadow-sm hover:scale-110 active:bg-accent active:scale-95 active:shadow-inner"
            >
              <Menu className="w-6 h-6" />
            </Button>
            <Link href="/" className="flex items-center gap-1">
              <div className="bg-red-600 p-1 rounded">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </div>
              <span className="text-lg font-medium sm:text-xl">YourTube</span>
              <span className="hidden text-xs text-muted-foreground ml-1 sm:inline">
                IN
              </span>
            </Link>
          </div>
          <form
            onSubmit={handleSearch}
            className="hidden flex-1 items-center gap-2 max-w-2xl mx-4 md:flex"
          >
            <div className="flex flex-1">
              <Input
                id="global-search-input"
                type="search"
                placeholder="Search"
                value={searchQuery}
                onKeyPress={handleKeypress}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-l-full border-r-0 focus-visible:ring-0"
              />
              <Button
                type="submit"
                className="rounded-r-full px-6 bg-muted text-muted-foreground border border-l-0"
              >
                <Search className="w-5 h-5" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full transition-all duration-200 hover:bg-accent hover:shadow-sm hover:scale-110 active:bg-accent active:scale-95 active:shadow-inner"
            >
              <Mic className="w-5 h-5" />
            </Button>
          </form>
          <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Search"
              onClick={() => setMobileSearchOpen(true)}
              className="md:hidden"
            >
              <Search className="w-5 h-5" />
            </Button>
            {user ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                  title="Video meeting"
                  className="hidden transition-all duration-200 hover:bg-accent hover:shadow-sm hover:scale-110 active:bg-accent active:scale-95 active:shadow-inner sm:inline-flex"
                >
                  <Link href="/meeting">
                    <VideoIcon className="w-6 h-6" />
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden transition-all duration-200 hover:bg-accent hover:shadow-sm hover:scale-110 active:bg-accent active:scale-95 active:shadow-inner sm:inline-flex"
                >
                  <Bell className="w-6 h-6" />
                </Button>
                <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full hover:bg-transparent!"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.image} />
                    <AvatarFallback>{user.name?.[0] || "U"}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                {user?.channelname ? (
                  <DropdownMenuItem
                    asChild
                    className="focus:bg-transparent! focus:text-inherit!"
                  >
                    <Link href={`/channel/${user?._id}`}>Your channel</Link>
                  </DropdownMenuItem>
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
                <DropdownMenuItem asChild>
                  <Link href="/downloads">Downloads</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/history">History</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/liked">Liked videos</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/watch-later">Watch later</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="focus:bg-transparent! focus:text-inherit!"
                >
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <>
            <Button
              className="flex items-center gap-2"
              onClick={() => router.push("/signin")}
            >
              <User className="w-4 h-4" />
              Log in
            </Button>
          </>
        )}{" "}
          </div>
        </div>
      )}
      <Channeldialogue
        isopen={isdialogeopen}
        onclose={() => setisdialogeopen(false)}
        mode="create"
      />
    </header>
  );
};

export default Header;
