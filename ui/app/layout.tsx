import type { Metadata } from 'next';
import './globals.css';
import SetupCheck from '@/components/SetupCheck';

export const metadata: Metadata = {
  title: 'GRIPHOOK',
  description: 'AI-powered deployment automation',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SetupCheck>{children}</SetupCheck>
      </body>
    </html>
  );
}
