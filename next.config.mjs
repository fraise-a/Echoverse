/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.jamendo.com',
      },
      {
        protocol: 'https',
        hostname: 'usercontent.jamendo.com',
      },
    ],
  },
  productionBrowserSourceMaps: false,
  transpilePackages: ['three'],
};

export default nextConfig;
