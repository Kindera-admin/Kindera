import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import Navbar from '@/components/Navbar';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Kindera',
  description: 'Connecting people with NGOs to make a difference together',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
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