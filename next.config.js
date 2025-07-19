/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Sử dụng cấu hình remotePatterns mới thay cho 'domains'
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
    // Cho phép Next.js xử lý và tối ưu ảnh dạng SVG
    dangerouslyAllowSVG: true,
  },
};

module.exports = nextConfig;