import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cora - Teachable AI Agent",
  description: "A teachable AI agent for education research",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-gray-50">{children}</body>
    </html>
  );
}
