import type { Metadata, Viewport } from 'next';
import './globals.scss';

export const metadata: Metadata = {
  title: 'AcroReader — Interactive PDF Reader',
  description: 'A responsive reader for interactive PDF documents.',
  applicationName: 'AcroReader',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
