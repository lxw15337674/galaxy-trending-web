'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface SearchableComboboxOption {
  value: string;
  label: string;
  keywords?: string[];
}

function sanitizeKeywords(values: Array<string | null | undefined>) {
  return values.flatMap((value) => {
    if (typeof value !== 'string') return [];
    const normalized = value.trim();
    return normalized ? [normalized] : [];
  });
}

interface SearchableComboboxProps {
  value: string;
  placeholder: string;
  options: SearchableComboboxOption[];
  onValueChange: (value: string) => void;
  searchPlaceholder?: string;
  emptyText?: string;
  triggerClassName?: string;
  contentClassName?: string;
}

export function SearchableCombobox({
  value,
  placeholder,
  options,
  onValueChange,
  searchPlaceholder,
  emptyText = '无匹配项',
  triggerClassName,
  contentClassName,
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => options.find((item) => item.value === value), [options, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between border-zinc-300 dark:border-zinc-700', triggerClassName)}
        >
          <span className="truncate text-left">{selected?.label ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn('w-[var(--radix-popover-trigger-width)] p-0', contentClassName)} align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder ?? `输入筛选 ${placeholder}`} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((item) => {
                const keywords = sanitizeKeywords([item.label, ...(item.keywords ?? [])]);

                return (
                  <CommandItem
                    key={item.value}
                    value={item.value}
                    keywords={keywords}
                    onSelect={() => {
                      onValueChange(item.value);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', item.value === value ? 'opacity-100' : 'opacity-0')} />
                    <span className="truncate">{item.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
