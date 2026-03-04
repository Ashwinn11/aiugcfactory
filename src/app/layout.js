import { Fraunces, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const manrope = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata = {
  title: "UGC Factory — AI Ad Creative Generator",
  description:
    "Generate scroll-stopping Facebook & Instagram ad creative with AI. UGC selfies, product hero shots, lifestyle scenes — at $0.04 per image.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${fraunces.variable} ${manrope.variable} ${jetbrainsMono.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
