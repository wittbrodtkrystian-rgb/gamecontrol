import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = { title: { default: "GameControl Cloud — hosting serwerów gier", template: "%s · GameControl Cloud" }, description: "Hosting serwerów Minecraft." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#07090f" };
export default function Root({ children }: { children: React.ReactNode }) {
  return <html lang="pl"><body className="min-h-screen font-sans">{children}</body></html>;
}
