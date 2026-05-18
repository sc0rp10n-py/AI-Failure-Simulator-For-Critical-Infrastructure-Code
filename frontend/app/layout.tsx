import type { Metadata } from "next";
import { Cormorant_Garamond, JetBrains_Mono } from "next/font/google";

import { Providers } from "@/components/providers";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "SentinelAI — Autonomous Failure Simulation",
  description:
    "AI-driven autonomous failure simulation and resilience analysis for critical infrastructure code.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${cormorant.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="min-h-full font-serif antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
