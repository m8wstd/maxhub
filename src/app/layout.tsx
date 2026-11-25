import type { Metadata } from "next";
import type { Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, Quicksand } from "next/font/google";
import { PwaRegistration } from "@/components/pwa-registration";
import "./globals.css";

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
  colorScheme: "light",
  themeColor: "#47b8ec",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${quicksand.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
