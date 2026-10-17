import type { Metadata } from "next";
import { Familjen_Grotesk, Hanken_Grotesk, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/site/header";

const familjen = Familjen_Grotesk({ variable: "--font-familjen", subsets: ["latin"], weight: ["500", "700"] });
const hanken = Hanken_Grotesk({ variable: "--font-hanken", subsets: ["latin"], weight: ["400", "500", "600"] });
const instrument = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400", style: "italic" });
const mono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Spatial",
  description: "XR components you can see in 3D, try in your headset, and ship as code.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${familjen.variable} ${hanken.variable} ${instrument.variable} ${mono.variable}`}>
        <Header />
        {children}
      </body>
    </html>
  );
}
