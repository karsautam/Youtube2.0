import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import NarrowSidebar from "@/components/NarrowSidebar";
import MobileHeader from "@/components/mobile/MobileHeader";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import NavBar from "@/components/NavBar";
import MiniPlayer from "@/components/MiniPlayer";
import { MiniPlayerProvider } from "@/lib/MiniPlayerContext";
import { VideoHistoryProvider } from "@/lib/VideoHistoryContext";
import { Toaster } from "@/components/ui/sonner";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { useRouter } from "next/router";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { UserProvider } from "../lib/AuthContext";
export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isMeetPage = router.pathname.startsWith("/meeting");
  const isWatchPage = router.pathname.startsWith("/watch");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <UserProvider>
      <MiniPlayerProvider>
      <VideoHistoryProvider>
      <KeyboardShortcuts />
      <div className="min-h-screen bg-background text-foreground">
        <title>Your-Tube Clone</title>
        <Head>
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1, viewport-fit=cover"
          />
        </Head>
        <Toaster />
        {isMeetPage ? (
          <Component {...pageProps} />
        ) : (
          <>
            <div className="hidden lg:block">
              <NavBar />
              <Header onMenuToggle={() => setSidebarOpen((o) => !o)} />
            </div>
            <MobileHeader onMenuToggle={() => setSidebarOpen((o) => !o)} />
            {!isWatchPage && <NarrowSidebar />}
            <div className="flex">
              {!isWatchPage && <div className="hidden lg:block w-[72px] shrink-0" />}
              <Sidebar
                open={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
              />
              <main className="min-w-0 flex-1 pb-20 lg:pb-0">
                <Component {...pageProps} />
              </main>
            </div>
            <MobileBottomNav />
          </>
        )}
        <MiniPlayer />
      </div>
      </VideoHistoryProvider>
      </MiniPlayerProvider>
    </UserProvider>
    </ThemeProvider>
  );
}
