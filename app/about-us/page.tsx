'use client';
import Image from 'next/image';
import HappyAttorney from './Happy Attorney.png';
import HappyClients from './Happy Clients.png';
import JollyIntroduction from './Jolly Introduction.png';
import JugglingAct from './Juggling Act.png';
import StoneAge from './Stone Age.png';
import TakingOnChallenges from './Taking On Challenges.png';
export default function OurStoryPage() {
  return (
    <div className="relative isolate px-6 pt-4 md:pt-14 lg:px-8">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 lg:-top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
        <div
          style={{
            clipPath:
              'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
          }}
          className="relative left-[calc(50%-11rem)] aspect-1155/678 w-144.5 -translate-x-1/2 rotate-30 bg-linear-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-288.75"
        />
      </div>

      <div>
        <div className="mx-auto max-w-7xl px-6 md:py-24 sm:pt-24 ">
          <div className="relative isolate overflow-hidden dark:bg-gray-900 px-6 py-4 sm:rounded-3xl sm:px-10 sm:py-24 lg:py-24 xl:px-24 dark:bg-gray-800/50 dark:after:pointer-events-none dark:after:absolute dark:after:inset-0 dark:after:inset-ring dark:after:inset-ring-white/10 dark:after:sm:rounded-3xl">
            <h1 className="text-4xl font-bold mb-8">Our Story</h1>
            <p className="mb-4">
              At Pro Bono Law, we believe that access to legal resources should
              be universal and equitable. Our journey began with a simple idea:
              to leverage technology to decrease the cost between those in need
              of legal assistance and the professionals.
            </p>
            <p className="mb-4">
              Pro Bono Law was created to address the challenges faced by both
              clients seeking legal help and attorneys looking to offer their
              services without the constraints of traditional practice. We
              envisioned a platform where AI could serve as a paralegal
              assistant, streamlining case management and enhancing client
              communication.
            </p>
            <p className="mb-4">
              Our mission is to democratize access to legal support, ensuring
              that everyone, regardless of their background or circumstances,
              can receive the assistance they need to navigate the legal system
              with confidence and dignity.
            </p>
            <h1 className="text-3xl font-bold mb-8 mt-8 italic pt-8">
              Time before AIMIE
            </h1>
            <div className="grid grid-cols-1 gap-4 mt-8">
              <div className="space-y-4 flex md:flex-row flex-col">
                <p className="p-4 self-center">
                  Let&apos;s take a journey through our story. Years ago, before
                  the age of AI, attorneys had a daunting task of managing cases
                  manually. Client engagement and tempering expectations were
                  like a world-class juggling act.
                </p>
                <Image
                  src={JugglingAct}
                  alt="Juggling Act"
                  className="rounded-lg shadow-md"
                  width={600}
                />
              </div>
              <div className="space-y-4 flex flex-col md:flex-row align-middle justify-center flex-col-reverse">
                <Image
                  src={StoneAge}
                  alt="Stone Age"
                  className="rounded-lg shadow-md"
                  width={600}
                />
                <p className="p-4 self-center">
                  In those days, attorneys would often find themselves buried
                  under piles of paperwork, struggling to keep up with the
                  demands of their clients. The legal landscape was complex and
                  ever-changing, making it difficult for attorneys to provide
                  timely and effective support.
                </p>
              </div>
              <div className="space-y-4 flex md:flex-row flex-col">
                <p className="p-4 self-center">
                  Now comes Pro Bono Law, revolutionizing the way attorneys and
                  clients interact. AIMIE, Our AI-powered platform trusted
                  paralegal assistant, helping attorneys manage their caseloads
                  more efficiently while providing clients with the support they
                  need.
                </p>
                <Image
                  src={JollyIntroduction}
                  alt="Jolly Introduction"
                  className="rounded-lg shadow-md"
                  width={600}
                />
              </div>
              <div className="space-y-4 flex md:flex-row flex-col flex-col-reverse">
                <Image
                  src={TakingOnChallenges}
                  alt="Taking On Challenges"
                  className="rounded-lg shadow-md"
                  width={600}
                />
                <p className="p-4 self-center">
                  With AIMIE, attorneys could now take on more cases with higher
                  quality and client satisfaction. The platform&apos;s
                  intelligent features allow for seamless communication,
                  document management, case tracking, declaration generating,
                  and more, making it easier than ever to navigate the
                  complexities of legal work.
                </p>
              </div>
              <div className="space-y-4 flex md:flex-row flex-col">
                <p className="p-4 self-center">
                  Today, Pro Bono Law continues to empower attorneys and clients
                  alike. Our platform is a beacon of hope for those seeking
                  justice, providing a lifeline to legal resources that were
                  once out of reach.
                </p>
                <Image
                  src={HappyAttorney}
                  alt="Happy Attorney"
                  className="rounded-lg shadow-md"
                  width={600}
                />
              </div>
              <div className="space-y-4 flex md:flex-row flex-col flex-col-reverse">
                <Image
                  src={HappyClients}
                  alt="Happy Clients"
                  className="rounded-lg shadow-md"
                  width={600}
                />
                <p className="p-4 self-center">
                  As we look to the future, Pro Bono Law remains committed to
                  its mission of making legal support accessible to all. We are
                  proud to be a part of this transformative journey, helping
                  attorneys and clients alike find success and satisfaction in
                  their legal endeavors.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-12 -z-10 -translate-y-1 transform-gpu blur-3xl lg:top-auto lg:-bottom-0 lg:-translate-y-20">
        <div
          style={{
            clipPath:
              'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
          }}
          className="aspect-1155/678 w-288.75 bg-linear-to-tr from-[#ff80b5] to-[#9089fc] opacity-25 dark:opacity-20"
        />
      </div>
    </div>
  );
}
