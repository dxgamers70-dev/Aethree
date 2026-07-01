import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "AeThree — own the agent, govern the agent",
  description:
    "AeThree is a launchpad where every AI agent gets a 3D face and an on-chain governance token. Holders vote to mutate its persona, skills, and behavior — every change anchored on-chain.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
