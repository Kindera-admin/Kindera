/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/webmail',
        destination: 'https://sg2plzcpnl509334.prod.sin2.secureserver.net:2096',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
