import type { Metadata } from "next";
import type { Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, Quicksand } from "next/font/google";
import Script from "next/script";
import { PwaRegistration } from "@/components/pwa-registration";
import "./globals.css";

const themeInitScript = `(() => {
  let preference = "system";
  try {
    const stored = window.localStorage.getItem("maxhub-theme");
    if (stored === "system" || stored === "light" || stored === "dark") preference = stored;
  } catch {}
  const resolved = preference === "system"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    : preference;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
})();`;

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "MaxHub",
  title: "MaxHub — seu espaço de foco",
  description: "Tarefas, notas e prazos em um só lugar.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MaxHub",
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: "#47b8ec",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="pt-BR"
      data-theme="light"
      data-theme-preference="system"
      className={`${inter.variable} ${quicksand.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <Script
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
          id="maxhub-theme-init"
          strategy="beforeInteractive"
        />
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
