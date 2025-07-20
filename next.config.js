/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'export', // <<< XÓA DÒNG NÀY
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