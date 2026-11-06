'use client';
import { StaffModel } from '@/lib/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const values = [
  {
    title: 'Access is local',
    description:
      'We partner with local attorneys to provide secured, personalized support for clients in their most urgent legal moments.',
  },
  {
    title: 'Data-first Approach',
    description:
      'Every case is handled with respect, transparency, and client-led decision making.',
  },
  {
    title: 'Results that last',
    description:
      'We focus on high-quality outcomes that expedite resolution and long-term stability for clients.',
  },
];

export default function TheTeamPage() {
  const [staffData, setStaffData] = useState<StaffModel[] | undefined>(
    undefined,
  );
  useEffect(() => {
    (async () => {
      const res = await fetch('/api/staff', {
        method: 'GET',
      });
      const data = await res.json();
      setStaffData(data);
    })();
  }, []);
  return (
    <main className={`relative overflow-hidden bg-primary text-primary`}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-20 h-72 w-72 rounded-full bg-[#f2c4a7]/60 blur-3xl" />
        <div className="absolute right-[-8rem] top-[-6rem] h-80 w-80 rounded-full bg-[#9fd4c6]/70 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-1/3 h-72 w-72 rounded-full bg-[#d3b7f5]/40 blur-3xl" />
      </div>

      <section className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-16 pt-20 sm:pt-24">
        <div className="flex flex-col gap-6">
          <p
            className="text-sm uppercase tracking-[0.4em] text-[#6f4a2f] dark:text-[#F09A55]/70"
            style={{ fontFamily: 'var(--font-body)' }}>
            Our Staff
          </p>
          <h1
            className="max-w-3xl text-2xl font-semibold leading-tight sm:text-5xl"
            style={{ fontFamily: 'var(--font-display)' }}>
            Meet the team building systems to deliver secured client data
            faster, accessibly, and with more care than ever before.
          </h1>
          <p
            className="max-w-2xl text-lg text-primary dark:text-primary/50"
            style={{ fontFamily: 'var(--font-body)' }}>
            Our solutions are built by a dedicated team of technologists who
            understand the urgency of every case and the importance of
            client-centered care. We are committed to delivering tools that
            empower attorneys to provide faster, more effective support to those
            in need.
          </p>
          <p
            className="text-base text-primary dark:text-primary/70"
            style={{ fontFamily: 'var(--font-body)' }}>
            Follow our work on{' '}
            <a href="https://github.com/ProBonoLaw" className="font-semibold hover:underline">
              GitHub
            </a>
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {values.map((value) => (
            <div
              key={value.title}
              className="rounded-3xl border border-[#e1cbb5] bg-white/80 dark:bg-gray-800 p-6 shadow-[0_18px_60px_rgba(71,45,26,0.08)]">
              <h3
                className="text-xl font-semibold"
                style={{ fontFamily: 'var(--font-display)' }}>
                {value.title}
              </h3>
              <p
                className="mt-3 text-sm text-primary dark:text-primary/50"
                style={{ fontFamily: 'var(--font-body)' }}>
                {value.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="flex flex-col gap-4">
          <p
            className="text-sm uppercase tracking-[0.35em] text-[#6f4a2f] dark:text-[#F09A55]/70"
            style={{ fontFamily: 'var(--font-body)' }}>
            The Team
          </p>
          <h2
            className="text-3xl font-semibold sm:text-4xl"
            style={{ fontFamily: 'var(--font-display)' }}>
            People you will meet in every case.
          </h2>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {staffData?.map((member) => (
            <Link
              href={`/staff/${member.staffId}`}
              key={member.staffId}
              aria-label={"View profile for " + member.displayName}
              className="group">
              <article className="group relative overflow-hidden rounded-[32px] border border-[#e1cbb5] bg-white/90 dark:bg-gray-800 p-6 shadow-[0_20px_60px_rgba(29,26,22,0.08)] transition-transform duration-500 hover:-translate-y-2">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#e8905a] via-[#f2c4a7] to-[#9fd4c6]" />
                <p
                  className="text-xs uppercase tracking-[0.3em] text-[#6f4a2f] dark:text-[#F09A55]/70 dark:font-semibold"
                  style={{ fontFamily: 'var(--font-body)' }}>
                  {member.role}
                </p>
                <h3
                  className="mt-3 text-2xl font-semibold text-primary dark:text-primary/80"
                  style={{ fontFamily: 'var(--font-display)' }}>
                  {member.displayName}
                </h3>
                <p
                  className="mt-3 text-sm text-[#3d332b] "
                  style={{ fontFamily: 'var(--font-body)' }}>
                  <span className="font-semibold text-[#6f4a2f] dark:text-[#F09A55]/60">
                    Focus:
                  </span>{' '}
                  <span className="text-[#3d332b] dark:text-[#BFAE9B]">
                    {member.focus}
                  </span>
                </p>
                <p
                  className="mt-4 text-sm text-[#4b4038] dark:text-[#BFAE9B]"
                  style={{ fontFamily: 'var(--font-body)' }}>
                  {member.highlight}
                </p>
              </article>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
