import type { Metadata } from 'next';
import './globals.css';
import SetupCheck from '@/components/SetupCheck';
import GlobalNav from '@/components/GlobalNav';

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
      <body className="antialiased min-h-screen bg-[#050505]">
        <SetupCheck>
          <GlobalNav />
          {children}
        </SetupCheck>
      </body>
    </html>
  );
}
