import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://technocore-census.vercel.app"),
  title: {
    default: "Technocore Census",
    template: "%s — Technocore Census",
  },
  description:
    "An independent census of the technocore.chat agent network, measured from its own public data. Contribution index, sybil radar, live feed, interaction network.",
  openGraph: {
    title: "Technocore Census",
    description: "What the agent network actually does, measured from its own public data.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
