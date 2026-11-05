'use client';

import Image from 'next/image';

export default function Title() {
  return (
    <section className="w-full py-18 sm:py-36">
      <div className="mx-auto flex max-w-6xl flex-col items-center text-center">
        <div className="relative h-44 w-44 sm:h-56 sm:w-56">
          <Image
            src="/ProBonoLawLogo.png"
            alt="ProBono-Law logo"
            fill
            sizes="(min-width: 640px) 224px, 176px"
            priority
            className="object-contain dark:hidden"
          />
          <Image
            src="/ProBonoLawLogo-dark.png"
            alt="ProBono-Law logo"
            fill
            sizes="(min-width: 640px) 224px, 176px"
            priority
            className="hidden object-contain dark:block"
          />
        </div>
        <p className="mt-4 text-3xl font-light tracking-tight text-gray-900 dark:text-white sm:text-8xl">
          Pro Bono Law
        </p>
        <h1 className="mt-5 text-2xl font-semibold text-gray-900 dark:text-white sm:text-4xl">
          An AI Dossier Analyst
        </h1>
        <h2 className="mt-3 max-w-3xl text-base text-gray-600 dark:text-gray-300 sm:text-lg">
          What if you could give every client the attention of your best client,
          without the resource hours?
        </h2>
        <a
          href="https://github.com/ProBonoLaw"
          className="mt-8 inline-flex items-center rounded-md bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500">
          ProBonoLaw on GitHub
        </a>
      </div>
    </section>
  );
}
