import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const mono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Spatial",
  description: "Spatial UI components you can see before you install them.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Cabinet Grotesk + Switzer aren't on Google Fonts; Fontshare (ITF Free Font License). */}
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@700,800&f[]=switzer@400,500,600&display=swap"
        />
      </head>
      <body className={`${mono.variable} antialiased`}>{children}</body>
    </html>
  );
}
