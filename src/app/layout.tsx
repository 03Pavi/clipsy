import { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ThemeRegistry from '../components/ui/theme-registry';
import { ReduxProvider } from '../components/providers/redux-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'OnePaste | The Mesh Clipboard',
  description: 'Seamlessly synchronize your clipboard across all devices in real-time.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'OnePaste',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#0070f3',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('Service Worker registration successful with scope: ', registration.scope);
                    },
                    function(err) {
                      console.log('Service Worker registration failed: ', err);
                    }
                  );
                });
              }
            `,
          }}
        />
        <ReduxProvider>
          <ThemeRegistry>
            {children}
          </ThemeRegistry>
        </ReduxProvider>
      </body>
    </html>
  );
}
