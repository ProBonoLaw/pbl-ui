import AppLayout from '@/components/AppLayout';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Providers from './providers';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://probono-law.com'),
  title: {
    default: 'Your Secured AI Legal Assistant | ProBono Law',
    template: '%s | ProBono Law',
  },
  description:
    'AI-powered legal assistant to help you understand documents, draft letters, and prepare questions for a lawyer.',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  },
  verification: {
    google: 'CSe5MII-QDzIUTOpuXN5r8M-Sf5EgAXVrTWRYnmfiFc',
  },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'ProBono Law',
    title: 'Your Secured AI Legal Assistant | ProBono Law',
    description:
      'Understand documents, draft letters, and prepare questions—faster and more affordable.',
    images: [],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Your Secured AI Legal Assistant | ProBono Law',
    description:
      'Understand documents, draft letters, and prepare questions—faster and more affordable.',
    images: [],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LegalService',
  name: 'ProBono Law',
  url: 'https://probono-law.com/',
  logo: 'https://probono-law.com/logo.png',
  image: 'https://probono-law.com/og/home.png',
  description:
    'AI-powered legal assistant helping consumers understand documents, draft letters, and prepare for attorney consultations.',
  areaServed: 'US',
  sameAs: ['https://github.com/ProBonoLaw'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-google-analytics-opt-out="">
      <head>
        <script
          type="application/ld+json"
          // This is the standard Next.js pattern for JSON-LD
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`relative flex min-h-full flex-col ${geistSans.variable} ${geistMono.variable} antialiased `}>
        <Providers>
          <AppLayout>{children}</AppLayout>
        </Providers>
      </body>
    </html>
  );
}
