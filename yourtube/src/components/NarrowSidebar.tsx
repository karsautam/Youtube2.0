import Link from "next/link";
import { useRouter } from "next/router";
import { Home, PlaySquare, User } from "lucide-react";
import { useUser } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

const items = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/shorts", icon: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 15v4a1 1 0 0 0 1 1h4" /><rect x="7" y="3" width="10" height="18" rx="2" /><circle cx="12" cy="12" r="1" />
    </svg>
  ), label: "Shorts" },
  { href: "/subscriptions", icon: PlaySquare, label: "Subscriptions" },
];

export default function NarrowSidebar() {
  const router = useRouter();
  const { user } = useUser();

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-23 bottom-0 z-30 w-[72px] bg-background border-r items-center py-2 gap-1">
      {items.map((item) => {
        const active = item.href === "/" ? router.pathname === "/" : router.pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 w-full py-3 text-[11px] transition-colors rounded-lg",
              active ? "text-foreground font-semibold" : "text-muted-foreground hover:bg-accent"
            )}
          >
            <Icon className="w-6 h-6" />
            <span>{item.label}</span>
          </Link>
        );
      })}
      <div className="w-8 border-t my-1" />
      {user ? (
        <Link
          href={user.channelname ? `/channel/${user._id}` : "/"}
          className={cn(
            "flex flex-col items-center justify-center gap-1 w-full py-3 text-[11px] transition-colors rounded-lg",
            router.pathname.startsWith("/channel") ? "text-foreground font-semibold" : "text-muted-foreground hover:bg-accent"
          )}
        >
          <Avatar className="w-6 h-6">
            <AvatarImage src={user.image} />
            <AvatarFallback>{user.name?.[0] || "U"}</AvatarFallback>
          </Avatar>
          <span>You</span>
        </Link>
      ) : (
        <Link
          href="/"
          className="flex flex-col items-center justify-center gap-1 w-full py-3 text-[11px] text-muted-foreground hover:bg-accent rounded-lg"
        >
          <User className="w-6 h-6" />
          <span>You</span>
        </Link>
      )}
    </aside>
  );
}
