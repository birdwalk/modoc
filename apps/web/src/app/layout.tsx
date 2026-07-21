import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "../components/Providers";

export const metadata: Metadata = {
  title: "MODOC | Diagnose. Repair. Ready.",
  description: "MODOC analyses 3D models, detects geometry problems, repairs safe defects and confirms readiness for gaming, visualisation, 3D printing or manufacturing workflows.",
  openGraph: {
    title: "MODOC",
    description: "Diagnose. Repair. Ready.",
    type: "website"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
