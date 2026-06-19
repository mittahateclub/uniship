import type { NextConfig } from "next";

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://apis.google.com https://*.firebaseio.com https://cdn.jsdelivr.net",
      "worker-src 'self' blob:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
      "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
      "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://*.googleusercontent.com",
      "connect-src 'self' https://*.googleapis.com https://*.google.com https://*.firebaseio.com https://*.firebase.com wss://*.firebaseio.com https://ce.judge0.com https://api.cloud.llamaindex.ai https://api.groq.com https://cdn.jsdelivr.net",
      "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Tree-shake the icon barrel so only the glyphs actually used are bundled
  // (faster builds, smaller client JS).
  experimental: {
    optimizePackageImports: ['@phosphor-icons/react'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  // Prevent leaking source maps in production
  productionBrowserSourceMaps: false,
};

export default nextConfig;
