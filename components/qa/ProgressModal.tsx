import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react';
import { DatabaseZapIcon } from 'lucide-react';
import AllDone from './All Done.png';
import GettingRequest from './GettingRequest.png';
import Research from './Research.png';
import Unlocking from './Unlocking.png';
import { useEffect, useState } from 'react';
import Image, { StaticImageData } from 'next/image';

const POSSIBLE_IMAGES: Array<{ image: StaticImageData; description: string }> = [
  {
    image: GettingRequest,
    description:
      'All your request information is being gathered and given to AIMIE.',
  },
  {
    image: Unlocking,
    description:
      'In order to fulfill your request, AIMIE is unlocking relevant information from your files.',
  },
  {
    image: Research,
    description:
      'AIMIE is researching the relevant information to provide accurate answers.',
  },
  {
    image: AllDone,
    description:
      'AIMIE is now correlating her findings to provide a comprehensive response.',
  },
];

export default function ProgressModal({ isLoading }: { isLoading: boolean }) {
  const [image, setImage] = useState<StaticImageData>(GettingRequest);
  const [passage, setPassage] = useState<string>('');

  useEffect(() => {
    if (!isLoading) {
      return;
    }

    let idx = 0;
    const { image: firstImage, description: firstDescription } =
      POSSIBLE_IMAGES[0];
    setPassage(firstDescription);
    setImage(firstImage);

    const interval = setInterval(() => {
      idx += 1;
      if (idx < POSSIBLE_IMAGES.length) {
        const { image: nextImage, description: nextDescription } =
          POSSIBLE_IMAGES[idx];
        setPassage(nextDescription);
        setImage(nextImage);
      } else {
        clearInterval(interval);
      }
    }, 10000);

    return () => {
      clearInterval(interval);
    };
  }, [isLoading]);

  return (
    isLoading && (
      <Dialog open={isLoading} onClose={() => {}} className="relative z-999">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-gray-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in dark:bg-gray-900/50"
        />

        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-center-safe justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel
              transition
              className="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 w-full max-w-sm lg:max-w-2xl sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95 dark:bg-gray-800 dark:outline dark:-outline-offset-1 dark:outline-white/10">
              <div>
                <div className="mx-auto flex size-12 md:size-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/10">
                  <DatabaseZapIcon
                    aria-hidden="true"
                    className="size-6 md:size-10 text-green-600 dark:text-green-400"
                  />
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <DialogTitle
                    as="h3"
                    className="text-base font-semibold text-gray-900 dark:text-white">
                    Processing Request
                  </DialogTitle>
                  <div className="mt-2">
                    <Image
                      src={image}
                      alt="Progress illustration"
                      width={image.width}
                      height={image.height}
                    />
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                      {passage}
                    </p>
                  </div>
                </div>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    )
  );
}
