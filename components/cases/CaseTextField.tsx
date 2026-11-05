import { cn } from '@/lib/cssHelper';

export const CaseTextField = ({
  title,
  type = 'text',
  fieldName,
  defaultValue,
  readOnly,
  className,
}: {
  title: string;
  type?: string;
  fieldName: string;
  defaultValue: string;
  readOnly: boolean;
  className?: string;
}) => {
  const newClassName = cn(
    'block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500 mt-2',
    className,
  );
  return (
    <>
      <label
        htmlFor={fieldName}
        className="block text-sm/6 font-medium text-gray-900 dark:text-white">
        {title}
      </label>
      <input
        type={type}
        aria-autocomplete="none"
        autoComplete="none"
        id={fieldName}
        name={fieldName}
        className={newClassName}
        defaultValue={defaultValue}
        readOnly={readOnly}
      />
    </>
  );
};
