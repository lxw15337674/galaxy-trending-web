'use client';

import { Check, ChevronDown } from 'lucide-react';
import {
  createContext,
  type InputHTMLAttributes,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils';

export interface ComboboxOption {
  value: string;
  label: string;
  keywords?: string[];
}

interface ComboboxContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  query: string;
  setQuery: (query: string) => void;
  selectedValue: string | null;
  filteredItems: unknown[];
  itemToValue: (item: unknown) => string;
  itemToLabel: (item: unknown) => string;
  selectByValue: (value: string) => void;
}

const ComboboxContext = createContext<ComboboxContextValue | null>(null);

function useComboboxContext() {
  const context = useContext(ComboboxContext);
  if (!context) {
    throw new Error('Combobox components must be used within <Combobox>.');
  }
  return context;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function defaultItemToValue(item: unknown) {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object' && 'value' in item) {
    const value = (item as { value?: unknown }).value;
    if (typeof value === 'string') return value;
  }
  return String(item ?? '');
}

function defaultItemToLabel(item: unknown) {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object' && 'label' in item) {
    const label = (item as { label?: unknown }).label;
    if (typeof label === 'string') return label;
  }
  return defaultItemToValue(item);
}

function defaultItemToKeywords(item: unknown) {
  if (!item || typeof item !== 'object' || !('keywords' in item)) return [] as string[];
  const keywords = (item as { keywords?: unknown }).keywords;
  if (!Array.isArray(keywords)) return [] as string[];
  return keywords.filter((keyword): keyword is string => typeof keyword === 'string');
}

interface ComboboxProps {
  items: readonly unknown[];
  value?: string | null;
  onValueChange?: (value: string, item: unknown) => void;
  itemToValue?: (item: unknown) => string;
  itemToLabel?: (item: unknown) => string;
  itemToKeywords?: (item: unknown) => string[];
  className?: string;
  children: ReactNode;
}

export function Combobox({
  items,
  value,
  onValueChange,
  itemToValue = defaultItemToValue,
  itemToLabel = defaultItemToLabel,
  itemToKeywords = defaultItemToKeywords,
  className,
  children,
}: ComboboxProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedValue = value ?? null;

  const itemMap = useMemo(() => {
    const map = new Map<string, unknown>();
    for (const item of items) {
      map.set(itemToValue(item), item);
    }
    return map;
  }, [items, itemToValue]);

  const selectedLabel = useMemo(() => {
    if (!selectedValue) return '';
    const selectedItem = itemMap.get(selectedValue);
    if (!selectedItem) return '';
    return itemToLabel(selectedItem);
  }, [itemMap, itemToLabel, selectedValue]);

  useEffect(() => {
    if (!selectedValue) {
      setQuery('');
      return;
    }
    const selectedItem = itemMap.get(selectedValue);
    setQuery(selectedItem ? itemToLabel(selectedItem) : '');
  }, [itemMap, itemToLabel, selectedValue]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!containerRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open]);

  const filteredItems = useMemo(() => {
    const keyword = normalizeText(query);
    const normalizedSelectedLabel = normalizeText(selectedLabel);
    const effectiveKeyword =
      keyword && normalizedSelectedLabel && keyword === normalizedSelectedLabel ? '' : keyword;
    if (!effectiveKeyword) return [...items];

    return items.filter((item) => {
      const valueText = normalizeText(itemToValue(item));
      const labelText = normalizeText(itemToLabel(item));
      const keywordText = itemToKeywords(item).map(normalizeText).join(' ');
      const haystack = `${valueText} ${labelText} ${keywordText}`;
      return haystack.includes(effectiveKeyword);
    });
  }, [items, itemToKeywords, itemToLabel, itemToValue, query, selectedLabel]);

  const selectByValue = (nextValue: string) => {
    const selectedItem = itemMap.get(nextValue);
    if (!selectedItem) return;
    setQuery(itemToLabel(selectedItem));
    setOpen(false);
    onValueChange?.(nextValue, selectedItem);
  };

  return (
    <ComboboxContext.Provider
      value={{
        open,
        setOpen,
        query,
        setQuery,
        selectedValue,
        filteredItems,
        itemToValue,
        itemToLabel,
        selectByValue,
      }}
    >
      <div ref={containerRef} className={cn('relative w-full', className)}>
        {children}
      </div>
    </ComboboxContext.Provider>
  );
}

type ComboboxInputProps = InputHTMLAttributes<HTMLInputElement>;

export function ComboboxInput({ className, onFocus, onKeyDown, onChange, ...props }: ComboboxInputProps) {
  const { open, query, setQuery, setOpen, filteredItems, itemToValue, selectByValue } = useComboboxContext();

  return (
    <div className="relative w-full">
      <input
        {...props}
        value={query}
        onFocus={(event) => {
          setOpen(true);
          onFocus?.(event);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
          } else if (event.key === 'Enter' && filteredItems.length > 0) {
            event.preventDefault();
            selectByValue(itemToValue(filteredItems[0]));
          }
          onKeyDown?.(event);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          onChange?.(event);
        }}
        className={cn(
          'h-10 w-full rounded-md border border-zinc-300 bg-background px-3 pr-9 text-sm outline-none ring-offset-background',
          'placeholder:text-zinc-500 focus:ring-2 focus:ring-ring focus:ring-offset-2 dark:border-zinc-700',
          className,
        )}
      />
      <ChevronDown
        className={cn(
          'pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 transition-transform dark:text-zinc-400',
          open ? 'rotate-180' : '',
        )}
      />
    </div>
  );
}

interface ComboboxContentProps {
  className?: string;
  children: ReactNode;
}

export function ComboboxContent({ className, children }: ComboboxContentProps) {
  const { open } = useComboboxContext();
  if (!open) return null;

  return (
    <div
      className={cn(
        'absolute top-[calc(100%+4px)] z-50 w-full overflow-hidden rounded-md border border-zinc-200 bg-popover p-1 shadow-md',
        'dark:border-zinc-800',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface ComboboxEmptyProps {
  className?: string;
  children: ReactNode;
}

export function ComboboxEmpty({ className, children }: ComboboxEmptyProps) {
  const { filteredItems } = useComboboxContext();
  if (filteredItems.length > 0) return null;
  return <div className={cn('py-2 text-center text-sm text-muted-foreground', className)}>{children}</div>;
}

interface ComboboxListProps {
  className?: string;
  children: (item: any) => ReactNode;
}

export function ComboboxList({ className, children }: ComboboxListProps) {
  const { filteredItems } = useComboboxContext();
  return <div className={cn('max-h-64 overflow-y-auto', className)}>{filteredItems.map((item) => children(item))}</div>;
}

interface ComboboxItemProps {
  value: string;
  className?: string;
  children: ReactNode;
}

export function ComboboxItem({ value, className, children }: ComboboxItemProps) {
  const { selectByValue, selectedValue } = useComboboxContext();
  const isSelected = selectedValue === value;

  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
        'hover:bg-accent hover:text-accent-foreground',
        className,
      )}
      onClick={() => selectByValue(value)}
    >
      <Check className={cn('h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
      <span className="truncate">{children}</span>
    </button>
  );
}
