import Link from "next/link";
import { useRouter } from "next/router";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Bell, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function MobileHeader({
  onMenuToggle,
}: {
  onMenuToggle?: () => void;
}) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background lg:hidden">
      {searchOpen ? (
        <form onSubmit={handleSubmit} className="flex h-14 items-center gap-1 px-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close search"
            onClick={() => setSearchOpen(false)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Input
            autoFocus
            type="search"
            inputMode="search"
            placeholder="Search YourTube"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 rounded-full"
          />
          <Button type="submit" variant="ghost" size="icon" aria-label="Search">
            <Search className="h-5 w-5" />
          </Button>
        </form>
      ) : (
        <div className="flex h-14 items-center justify-between pl-1 pr-1">
          <div className="flex min-w-0 items-center">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle menu"
              onClick={onMenuToggle}
              className="shrink-0"
            >
              <Menu className="h-6 w-6" />
            </Button>
            <Link href="/" aria-label="YourTube home" className="flex items-center gap-1.5">
            <span className="rounded-md bg-red-600 p-1.5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </span>
            <span className="text-lg font-semibold tracking-tight">YourTube</span>
          </Link>
          </div>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-[22px] w-[22px]" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="h-[22px] w-[22px]" />
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}