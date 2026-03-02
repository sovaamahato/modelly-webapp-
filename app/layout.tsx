import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import './globals.css';
import Navbar from './components/Navbar';

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '600', '700'] });

export const metadata: Metadata = {
  title: 'Modelly — AI Personalized Model Images',
  description: 'Combine your photo with a model image to create realistic personalized images.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={dmSans.className}>
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
