import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getServerFoundation } from "@/server/foundation/provider";
import type { AppTheme } from "@/types";

import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Multi View Multi Class Event Localizer",
  description:
    "Configuration-driven temporal event localization across synchronized video views.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  let theme: AppTheme = "dark";
  try {
    theme = (await getServerFoundation()).deployment.theme;
  } catch {
    // The status page renders the centralized actionable error.
  }

  return (
    <html data-theme={theme} lang="en">
      <body>{children}</body>
    </html>
  );
}
