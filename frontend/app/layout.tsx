import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "FairPlan",
    template: "%s · FairPlan",
  },
  description: "Overblik over perioder, organisering, adgange og personale.",
  icons: { icon: "/fairplan.ico" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="da">
      <body>{children}</body>
    </html>
  );
}
