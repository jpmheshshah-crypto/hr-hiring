import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BPO Hiring Dashboard",
  description: "AI-assisted hiring dashboard for BPO recruitment teams."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
