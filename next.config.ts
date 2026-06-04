import type { NextConfig } from "next";

// Supabase project host — product images are served from its public storage bucket.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const securityHeaders = [
  // Don't leak full URLs as referrer to third parties.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Block MIME-type sniffing.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Legacy clickjacking guard (CSP frame-ancestors is the modern one).
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Lock down powerful browser features we don't use.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), payment=(), interest-cohort=()' },
  // Force HTTPS for 2 years (incl. subdomains). Safe on Vercel (always HTTPS).
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'drive.google.com' },
      ...(supabaseHost ? [{ protocol: 'https' as const, hostname: supabaseHost }] : []),
    ],
  },
  // Don't expose the framework version header.
  poweredByHeader: false,
  // Gzip/brotli responses.
  compress: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
