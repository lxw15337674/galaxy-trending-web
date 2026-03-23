'use client';

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  type ComboboxOption,
} from '@/components/ui/combobox';

interface FilterComboboxProps {
  options: readonly ComboboxOption[];
  value: string;
  placeholder: string;
  emptyText: string;
  onValueChange: (value: string) => void;
}

export function FilterCombobox({
  options,
  value,
  placeholder,
  emptyText,
  onValueChange,
}: FilterComboboxProps) {
  return (
    <Combobox items={options} value={value} onValueChange={(nextValue) => onValueChange(nextValue)}>
      <ComboboxInput placeholder={placeholder} />
      <ComboboxContent>
        <ComboboxEmpty>{emptyText}</ComboboxEmpty>
        <ComboboxList>
          {(rawItem) => {
            const item = rawItem as ComboboxOption;
            return (
              <ComboboxItem key={item.value} value={item.value}>
                {item.label}
              </ComboboxItem>
            );
          }}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

