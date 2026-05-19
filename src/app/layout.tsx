import { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ThemeRegistry from '../components/ui/theme-registry';
import { ReduxProvider } from '../components/providers/redux-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'OnePaste | The Mesh Clipboard',
  description: 'Seamlessly synchronize your clipboard across all devices in real-time.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ReduxProvider>
          <ThemeRegistry>
            {children}
          </ThemeRegistry>
        </ReduxProvider>
      </body>
    </html>
  );
}
