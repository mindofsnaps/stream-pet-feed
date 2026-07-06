import type { Metadata } from "next";
import "./globals.css";

/**
 * Root layout. Deliberately minimal — no global header/footer chrome, so the
 * OBS overlay route (which returns its own bare HTML document) and the public
 * pages stay clean. Set NEXT_PUBLIC_CHANNEL_NAME to put your channel in the
 * default page title.
 */

const channel = process.env.NEXT_PUBLIC_CHANNEL_NAME || "the stream";

export const metadata: Metadata = {
  title: `pet picture feed — ${channel}`,
  description:
    "viewers submit pet photos, the streamer approves them, approved pets rotate through an on-stream overlay.",
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
