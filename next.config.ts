import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Externalize native Node.js modules that can't be bundled by Turbopack
  serverExternalPackages: [
    "@envio-dev/hypersync-client",
    "@envio-dev/hypersync-client-win32-x64-msvc",
  ],
};

export default nextConfig;
