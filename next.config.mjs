import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

/**
 * `next dev` and `next build` get separate output folders. They used to share `.next`, and every
 * build (or the old `dev` script's clean step) deleted the chunks a running dev server was still
 * serving, which left pages without JavaScript or fonts until the server was restarted.
 */
export default function nextConfig(phase) {
  const dev = phase === PHASE_DEVELOPMENT_SERVER;
  return {
    distDir: process.env.NEXT_BUILD_DIR || (dev ? '.next-dev' : '.next'),
    reactStrictMode: true,
    transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
    images: {
      formats: ['image/avif', 'image/webp'],
      remotePatterns: [
        {
          protocol: 'https',
          hostname: 'images.unsplash.com',
        },
      ],
    },
  };
}
