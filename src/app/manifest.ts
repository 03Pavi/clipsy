import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'OnePaste',
    short_name: 'OnePaste',
    description: 'Seamlessly synchronize your clipboard across all devices in real-time.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0070f3',
    icons: [
      {
        src: '/favicon.png',
        sizes: 'any',
        type: 'image/x-icon',
      },
      {
        src: '/logo.png',
        sizes: '1024x1024',
        type: 'image/png',
      },
    ],
  };
}
