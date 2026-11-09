/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // small Docker image (see Dockerfile)
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }, { key: 'Service-Worker-Allowed', value: '/' }] },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(self), payment=(self)' },
        ],
      },
    ];
  },
};
export default nextConfig;
