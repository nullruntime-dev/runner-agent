import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Runner Agent',
  description: 'Remote command executor UI',
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
