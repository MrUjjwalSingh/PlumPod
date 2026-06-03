import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Plum AI Adjudicator — Insurance Automation Platform",
  description:
    "AI-powered insurance claims adjudication platform for automated, transparent, and auditable healthcare claim processing.",
  keywords: ["insurance", "claims", "adjudication", "AI", "healthcare", "automation"],
  authors: [{ name: "Plum Insurance" }],
  openGraph: {
    title: "Plum AI Adjudicator",
    description: "Automated insurance claims processing powered by AI",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen" suppressHydrationWarning>
        {/* Ambient background gradients */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        >
          <div className="absolute -top-48 -left-48 h-[600px] w-[600px] rounded-full bg-violet-600/10 blur-[120px]" />
          <div className="absolute top-1/3 right-0 h-[400px] w-[400px] rounded-full bg-cyan-600/8 blur-[100px]" />
          <div className="absolute bottom-0 left-1/4 h-[300px] w-[300px] rounded-full bg-purple-800/8 blur-[80px]" />
        </div>
        {children}
      </body>
    </html>
  );
}
