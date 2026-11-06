'use client';
import AuthPanel from '@/components/home/AuthPanel';
import CasePanel from '@/components/home/CasePanel';
import Title from '@/components/home/Title';
import { useAuth } from '@/hooks/useAuth';
import WhoWeAre from '@/components/home/WhoWeAre';
import Highlights from '@/components/home/Highlights';
import WhatsDifferent from '@/components/home/WhatsDifferent';
import HowItWorks from '@/components/home/HowItWorks';
import Faq from '@/components/home/FAQ';
import ContactUs from '@/components/home/ContactUs';
import PrivacyPolicies from '@/components/home/PrivacyPolicies';

export default function Home() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="relative isolate px-6 pt-4 md:px-8">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
          <div
            style={{
              clipPath:
                'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
            }}
            className="relative left-[calc(50%-11rem)] aspect-1155/678 w-144.5 -translate-x-1/2 rotate-30 bg-linear-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-288.75"
          />
        </div>
        <div className="mx-auto md:py-48 lg:py-56">
          <Title />
          <WhoWeAre />
          <Highlights />
          <PrivacyPolicies />
          <WhatsDifferent />
          <HowItWorks />
          <Faq />
          <ContactUs />
        </div>
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]">
          <div
            style={{
              clipPath:
                'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
            }}
            className="relative left-[calc(50%+3rem)] aspect-1155/678 w-144.5 -translate-x-1/2 bg-linear-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%+36rem)] sm:w-288.75"
          />
        </div>
      </div>
    );
  }
  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] justify-items-center min-h-screen p-8 pb-20 ">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <AuthPanel />
        <CasePanel />
      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center"></footer>
    </div>
  );
}
