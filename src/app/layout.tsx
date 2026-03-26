import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import "./globals.css";
import { Providers } from "./providers";

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
      <body>
        <Providers>
          <AppHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
