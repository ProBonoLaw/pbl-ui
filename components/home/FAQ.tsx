import type { JSX } from 'react';

type FaqItem = {
  question: string;
  answer: JSX.Element;
};

const faqs: FaqItem[] = [
  {
    question: 'Is my data safe and kept private?',
    answer: (
      <>
        Yes. Data is encrypted at rest and in transit, ProBono-Law supports
        HIPAA-governed workflows through its contractual safeguards, and the
        platform has SOC 2 Type 2 attestation materials available. Furthermore,
        we use Zero Data Retention on AI queries.
      </>
    ),
  },
  {
    question: 'Does ProBono-Law use my data to train its AI models?',
    answer: (
      <>
        No. ProBono-Law does not use client data to train AI models. We value
        our clients&apos; privacy and recognize the sensitive nature of their
        information.
      </>
    ),
  },
  {
    question: 'What is Zero Data Retention?',
    answer: (
      <>
        Zero Data Retention (ZDR) is where a platform does not store sensitive
        data unless explicitly required. This means that our AI accesses,
        processes, and discards sensitive data in real time, without storing for
        later use.
      </>
    ),
  },
  {
    question: 'Is my data saved after I delete my case?',
    answer: (
      <>
        When you create an account with ProBono-Law, we create a SharePoint site
        that stores the records you upload. Those records are protected by
        SharePoint&apos;s native encryption at rest. When you delete your
        account, we delete the SharePoint site and, along with it, all your
        data.
      </>
    ),
  },
  {
    question: 'What does Pro Bono mean?',
    answer: (
      <>
        “Pro Bono” is short for the Latin phrase “pro bono publico” which
        translates to “for the public good.” The phrase emphasizes{' '}
        <span className="italic">public benefit</span>. We chose that name
        because our goal is to make in-depth, individualized legal
        representation affordable for everyone. We do that by drastically
        reducing the research and articulation hours necessary.
      </>
    ),
  },
  {
    question: 'Can I trust the answers and arguments given?',
    answer: (
      <>
        Everything should be proof read and fact checked by a licensed attorney.
        ProBono-Law does not replace an attorney, but drastically reduce the
        hours necessary to give top-tier legal representation. All answers are
        given with citations to easily be fact checked. Furthermore, we employ a
        vigorous system of validation to ensure accurate and true information is
        given.
      </>
    ),
  },
  {
    question: 'Do existing AI services do the same thing as ProBono-Law?',
    answer: (
      <>
        ProBono-Law is unique from existing competitors in multiple ways. (1)
        ProBono-Law searches all your case documents, reports, pleadings,
        emails, records, etc with every query. Others limit themselves based on
        number records or size of records. (2) ProBono-Law does not forget your
        data regardless of how many records you upload. (3) ProBono-Law argues
        for the benefit of your client with facts based on your dossier.
      </>
    ),
  },
  {
    question: 'I already have a CMS. Does ProBono-Law create more work for me?',
    answer: (
      <>
        You may have to save the same records in your existing CMS system and
        ProBono-Law. You can bulk upload records to make this easier. We save
        you significantly more time in research and argument formation hours.
        <br />
        <span className="font-semibold">Importantly:</span> ProBono-Law
        eliminates many of the situations for manually looking up documents. You
        can ask ProBono-Law to provide the record you&apos;re looking for. Or
        ask ProBono-Law to provide the information you wanted rather than find
        the necessary document. Furthermore, we can work with you to create a
        SharePoint based CMS or integrate with your current SharePoint system.
      </>
    ),
  },
  {
    question: 'Can ProBono-Law replace my current CMS system?',
    answer: (
      <>
        Short answer is yes, but that is not our core function. We provide an
        entirely new service as an AI Dossier System. That said, you can
        manually find and sort any documents saved on ProBono-Law. Furthermore
        we can create a SharePoint enabled CMS system independent, but
        integrated with our AI Dossier System.
      </>
    ),
  },
  {
    question: 'Is there negative publicity on using AI for legal work?',
    answer: (
      <>
        Negative publicity in law due to AI can be attributed to misuse of AI
        and putting a “legal wrapper” over existing AI models not designed for
        legal uses. Both issues mitigated with our system. ChatGPT hit the
        mainstream in 2022 and many tried to get “first to market” with their
        “AI wrappers.” We on the other hand, spent the past 2 years developing a
        system specifically designed for legal use. We advocate for your client,
        fact check and give citations, handle large bodies of evidence, and
        results are given with the expectation of criticism.
      </>
    ),
  },
  {
    question: 'What if documents are hand-written or text is an image?',
    answer: (
      <>
        ProBono-Law does run OCR and both hand-written notes and text as an
        image when necessary. This does use extra tokens.
      </>
    ),
  },
  {
    question: 'Can ProBono-Law analyze audio and video files?',
    answer: (
      <>
        Yes. ProBono-Law supports analysis of uploaded audio and video files.
        Supported video formats are .mp4, .mov, .m4v, .avi, .mkv, .wmv, and
        .webm. Supported audio formats are .aac, .aiff, .amr, .flac, .m4a,
        .mp3, .ogg, .opus, .wav, and .wma.
      </>
    ),
  },
  {
    question: 'Where can I follow the project?',
    answer: (
      <>
        Follow development through the{' '}
        <a href="https://github.com/ProBonoLaw" className="font-semibold hover:underline">
          ProBonoLaw organization on GitHub
        </a>
        .
      </>
    ),
  },
];

export default function FAQ() {
  return (
    <section className="w-full py-16 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            FAQ
          </h2>
        </div>

        <dl className="mx-auto mt-12 space-y-8">
          {faqs.map((faq) => (
            <div
              key={faq.question}
              className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <dt className="text-base font-semibold text-gray-900 dark:text-white">
                {faq.question}
              </dt>
              <dd className="mt-2 text-base text-gray-600 dark:text-gray-300">
                {faq.answer}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-10 text-center">
          <a
            href="https://github.com/ProBonoLaw"
            className="inline-flex items-center rounded-md bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500">
            Explore ProBonoLaw on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
