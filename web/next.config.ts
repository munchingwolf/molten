import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the Quest load the laptop dev server through a cloudflared HTTPS tunnel (WebXR needs HTTPS).
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
