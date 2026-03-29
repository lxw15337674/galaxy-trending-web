import type { YouTubeCategory, YouTubeHotQueryItem, YouTubeHotSort, YouTubeRegion } from '@/lib/youtube-hot/types';

export interface YouTubeHotInitialData {
  region: string;
  category: string;
  sort: YouTubeHotSort;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: YouTubeHotQueryItem[];
  regions: YouTubeRegion[];
  categories: YouTubeCategory[];
  generatedAt: string;
  errorMessage?: string | null;
}

export interface YouTubeHotHistoryResponse {
  batch: {
    snapshotHour: string;
    generatedAt: string;
  } | null;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  data: YouTubeHotQueryItem[];
  error?: string;
}

export interface YouTubeHotFiltersResponse {
  data: {
    regions: YouTubeRegion[];
    categories: YouTubeCategory[];
  };
  error?: string;
}
