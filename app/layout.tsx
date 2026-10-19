import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mimo — Your little mind, with a memory of its own",
  description: "An evidence-backed personal memory buddy.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
