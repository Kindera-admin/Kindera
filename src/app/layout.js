import { Inter, DM_Serif_Display, Great_Vibes } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import Navbar from '@/components/Navbar';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
// Marketing display and certificate signature faces: not preloaded on every route,
// they load on the pages that use them.
const dmSerif = DM_Serif_Display({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-dm-serif', preload: false });
const greatVibes = Great_Vibes({ subsets: ['latin'], weight: '400', variable: '--font-great-vibes', preload: false });

export const metadata = {
  title: 'Kindera',
  description: 'Connecting people with NGOs to make a difference together',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`h-full ${inter.variable} ${dmSerif.variable} ${greatVibes.variable}`}>
      <body className={`${inter.className} min-h-full flex flex-col`}>
        <Navbar />
        <main className="container mx-auto py-4 sm:py-6 md:py-8 px-4 flex-grow">
          {children}
        </main>
        <Toaster closeButton />
      </body>
    </html>
  );
}