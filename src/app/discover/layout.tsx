import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Discover users | MovieApp",
  description: "Search for people on MovieApp"
};

export default function DiscoverLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return children;
}
