import type { Metadata } from "next";
import { IBM_Plex_Sans, JetBrains_Mono, Syne } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const syne = Syne({ variable: "--font-syne", subsets: ["latin"] });
const plex = IBM_Plex_Sans({ variable: "--font-plex", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Vyra testnet validator",
  description: "Alpenglow testnet validator operated by Vyra Labs",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${plex.variable} ${jetbrains.variable} h-full antialiased`}
      suppressHydrationWarning // extensions like Dark Reader add attributes to <html> before React loads
    >
      <body className="min-h-full">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
