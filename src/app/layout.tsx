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
        {/* Soft ambient warmth */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        >
          <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-indigo-100/60 blur-[100px]" />
          <div className="absolute top-1/2 right-0 h-[350px] w-[350px] rounded-full bg-teal-100/50 blur-[90px]" />
        </div>
        {children}
      </body>
    </html>
  );
}
