export interface YouTubeHotBoardOption {
  boardKey: string;
  boardName: string;
}

export interface YouTubeHotHourlyItem {
  itemKey: string;
  boardKey: string;
  boardName: string;
  rank: number;
  title: string;
  thumbnailUrl: string | null;
  scoreText: string | null;
  scoreValue: number | null;
  url: string | null;
  channelTitle: string | null;
  publishedAt: string | null;
  snapshotHour: string;
  fetchedAt: string;
}
