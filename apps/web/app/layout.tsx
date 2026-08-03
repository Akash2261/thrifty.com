import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Thrifty",
  description: "Track warranties. Stop paying for subscriptions you forgot.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
