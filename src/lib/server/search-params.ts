export type SearchParamRawValue = string | string[] | undefined;

export interface SearchParamsObject {
  [key: string]: SearchParamRawValue;
}

export type SearchParamsLike = {
  get: (name: string) => string | null;
  getAll?: (name: string) => string[];
};

export type SearchParamsInput = SearchParamsObject | SearchParamsLike | null | undefined;

export function isSearchParamsLike(value: unknown): value is SearchParamsLike {
  if (!value || typeof value !== 'object') return false;
  return typeof (value as SearchParamsLike).get === 'function';
}

export function readSearchParamRaw(
  searchParams: SearchParamsInput,
  key: string,
): SearchParamRawValue {
  if (!searchParams) return undefined;

  if (isSearchParamsLike(searchParams)) {
    const all = typeof searchParams.getAll === 'function' ? searchParams.getAll(key) : [];
    if (all.length > 1) return all;
    if (all.length === 1) return all[0];
    const value = searchParams.get(key);
    return value ?? undefined;
  }

  return searchParams[key];
}

export function readSearchParamFirst(
  searchParams: SearchParamsInput,
  key: string,
): string | undefined {
  const raw = readSearchParamRaw(searchParams, key);
  return Array.isArray(raw) ? raw[0] : raw;
}
