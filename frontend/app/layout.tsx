import type { Metadata } from "next";
import { Google_Sans, JetBrains_Mono } from "next/font/google";

import { Providers } from "@/components/providers";
import "./globals.css";
import ViewTracker from "@/components/view-tracker";
import { headers } from "next/dist/server/request/headers";

const googleSans = Google_Sans({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-google-sans",
    // Google Sans has no size-adjust metrics in next/font yet; avoids dev warnings.
    adjustFontFallback: false,
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

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const headerList = await headers();
    const host = headerList.get("host") || "";

    return (
        <html
            lang="en"
            className={`dark ${googleSans.variable} ${jetbrainsMono.variable} h-full`}
            suppressHydrationWarning
        >
            <body
                className="min-h-full font-sans antialiased"
                suppressHydrationWarning
            >
                <ViewTracker host={host} />
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
