'use client';

import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react';
import { useMemo, useState } from 'react';

export type SearchableSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  searchText?: string;
};

type SearchableSelectProps = {
  ariaLabel: string;
  disabled?: boolean;
  emptyMessage?: string;
  id: string;
  options: SearchableSelectOption[];
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
};

export default function SearchableSelect({
  ariaLabel,
  disabled = false,
  emptyMessage = 'No matching options.',
  id,
  options,
  placeholder,
  value,
  onChange,
}: SearchableSelectProps) {
  const [query, setQuery] = useState('');
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) =>
      [option.label, option.value, option.searchText ?? ''].some((text) =>
        text.toLocaleLowerCase().includes(normalizedQuery),
      ),
    );
  }, [options, query]);
  const filteredValues = useMemo(
    () => filteredOptions.map((option) => option.value),
    [filteredOptions],
  );
  const optionsByValue = useMemo(
    () => new Map(options.map((option) => [option.value, option])),
    [options],
  );

  return (
    <Combobox
      value={value}
      onChange={(nextValue) => {
        if (nextValue === null) {
          return;
        }
        onChange(nextValue);
        setQuery('');
      }}
      immediate
      virtual={
        filteredValues.length > 0
          ? {
              options: filteredValues,
              disabled: (optionValue) =>
                optionsByValue.get(optionValue)?.disabled ?? false,
            }
          : null
      }>
      <div className="relative mt-2">
        <ComboboxInput
          aria-label={ariaLabel}
          id={id}
          displayValue={(selectedValue: string) =>
            options.find((option) => option.value === selectedValue)?.label ??
            selectedValue
          }
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="block w-full rounded-md bg-white px-3 py-1.5 pr-10 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
        />
        <ComboboxButton
          aria-label={`Show ${ariaLabel} options`}
          disabled={disabled}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 dark:text-gray-300">
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="size-5">
            <path d="m5 7.5 5 5 5-5" />
          </svg>
        </ComboboxButton>
        <ComboboxOptions
          modal={false}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-sm shadow-lg ring-1 ring-black/10 focus:outline-hidden dark:bg-gray-800 dark:ring-white/10">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-gray-600 dark:text-gray-300">
              {emptyMessage}
            </div>
          ) : (
            ({ option: optionValue }: { option: string }) => {
              const option = optionsByValue.get(optionValue);
              return (
                <ComboboxOption
                  key={optionValue}
                  value={optionValue}
                  disabled={option?.disabled}
                  className="group flex cursor-default items-center gap-2 px-3 py-2 text-gray-900 data-focus:bg-indigo-600 data-focus:text-white data-disabled:cursor-not-allowed data-disabled:opacity-50 dark:text-white">
                  <span className="invisible text-indigo-600 group-data-selected:visible group-data-focus:text-white">
                    ✓
                  </span>
                  {option?.label ?? optionValue}
                </ComboboxOption>
              );
            }
          )}
        </ComboboxOptions>
      </div>
    </Combobox>
  );
}
