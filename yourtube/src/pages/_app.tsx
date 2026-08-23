import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import { Toaster } from "@/components/ui/sonner";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { UserProvider } from "../lib/AuthContext";
export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isMeetPage = router.pathname.startsWith("/meeting");
  return (
    <UserProvider>
      <KeyboardShortcuts />
      <div className="min-h-screen bg-white text-black">
        <title>Your-Tube Clone</title>
        <Toaster />
        {isMeetPage ? (
          <Component {...pageProps} />
        ) : (
          <>
            <Header />
            <div className="flex">
              <Sidebar />
              <Component {...pageProps} />
            </div>
          </>
        )}
      </div>
    </UserProvider>
  );
}
