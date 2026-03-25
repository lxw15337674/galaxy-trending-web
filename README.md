# Galaxy Trending Web

YouTube-only trending site with:

- YouTube 视频榜（小时抓取，按地区）
- YouTube 直播榜（定时抓取，全局前 N）

## Tech Stack

- vinext (Vite + App Router)
- Cloudflare Workers
- Turso (libSQL)
- Drizzle ORM

## Environment Variables

Required:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `YOUTUBE_API_KEY_DAILY` (用于 `crawl:youtube:trending`)
- `YOUTUBE_API_KEY_LIVE` (用于 `crawl:youtube:live`)

## Local Development

```bash
pnpm install
pnpm dev
```

## Crawl Commands

```bash
# only purges YouTube live snapshots
pnpm db:purge -- --days=30
pnpm crawl:youtube:trending
pnpm crawl:youtube:trending -- --dry-run

pnpm crawl:youtube:live
pnpm crawl:youtube:live -- --max-results=200 --search-pages=4 --retention-days=30 --query=live
pnpm crawl:youtube:live -- --dry-run
```

## API

- `GET /api/youtube-hot-history?page=1&pageSize=20`
- `GET /api/youtube-hot-history/filters`
- `GET /api/db-health`

## Time Semantics

- `snapshot_hour`: 统计小时（Asia/Shanghai），用于榜单聚合与时间筛选。
- `fetched_at` / `crawled_at`: 抓取入库时间（UTC ISO 8601）。

## GitHub Actions

- `.github/workflows/youtube-trending-crawl.yml`
- `.github/workflows/youtube-live-crawl.yml`

Both workflows run `pnpm db:migrate` before crawling. The live workflow additionally runs
`pnpm db:purge -- --days=30` after crawling (live snapshots only; trending snapshots are retained).

Required repository secrets:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `YOUTUBE_API_KEY_DAILY`
- `YOUTUBE_API_KEY_LIVE`
