
import type { Metadata } from "next";
import StoreProvider from "@/app/providers/store-provider";
import { FirebaseProvider } from "@/app/providers/firebase-provider";
import "./globals.scss";

export const metadata: Metadata = {
  title: "SyncFlow | Enterprise Mesh Sync",
  description: "Advanced zero-latency synchronization across your local hardware mesh and enterprise cloud.",
  icons: {
    icon: "/logo.png",
    shortcut: "/favicon.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning={true}>
        <StoreProvider>
          <FirebaseProvider>
            {children}
          </FirebaseProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
