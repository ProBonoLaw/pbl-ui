'use client';
import FAQ from '@/components/home/FAQ';
import DecorativePageBackground from '@/components/DecorativePageBackground';

export default function FAQPage() {
  return (
    <div className="relative isolate px-6 pt-4 md:pt-14 lg:px-8">
      <DecorativePageBackground />
      <FAQ />
    </div>
  );
}
