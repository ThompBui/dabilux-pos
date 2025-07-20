/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // <<< THÊM DÒNG NÀY VÀO ĐÂY
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
    dangerouslyAllowSVG: true,
  },
};

module.exports = nextConfig;