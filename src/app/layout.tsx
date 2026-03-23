import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MovieApp",
  description: "TV/movie tracking app MVP"
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
