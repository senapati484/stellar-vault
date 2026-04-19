import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empty turbopack config satisfies Next.js 16's requirement to acknowledge
  // Turbopack usage (prevents the "webpack config with no turbopack config"
  // error). No custom aliases needed — the Transaction class identity fix is
  // handled in application code via XDR round-tripping.
  turbopack: {},
};

export default nextConfig;
