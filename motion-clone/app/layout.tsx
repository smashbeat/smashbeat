import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Beatreel — Creative Analytics for Performance Ads",
  description:
    "A snapshot of how your ad creatives are spending, converting, and fatiguing across paid social.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
