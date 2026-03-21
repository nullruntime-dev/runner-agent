import type { Metadata } from 'next';
import './globals.css';

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
      <body className="antialiased">{children}</body>
    </html>
  );
}
