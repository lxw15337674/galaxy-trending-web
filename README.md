# Galaxy Trending Web

YouTube-only trending site with:

- YouTube 视频榜（每 2 小时抓取，按地区）
- YouTube 直播榜（定时抓取，全局前 N）
- X Trends（按小时抓取，当前可先跑单地区，配置层已支持后续扩展为多地区串行）

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

For X Trends crawler, always required:

- `X_TREND_REGION_KEY`

`X_TREND_REGION_KEY` is the only external region input. The crawler resolves a human-readable label from an internal region map before writing logs and database rows.

X Trends cookie source selection:

- `X_TREND_COOKIE_SOURCE`
  - `storage_state_file`: 从本地 Playwright `storageState` 文件读取 cookie，适合本地调试
  - `admin_api`: 从管理接口 `GET /api/admin/gist-cookie?website=x.com` 读取 cookie，适合 GitHub Actions / 线上定时抓取

If `X_TREND_COOKIE_SOURCE=storage_state_file`:

- `X_TREND_STORAGE_STATE_PATH`

If `X_TREND_COOKIE_SOURCE=admin_api`:

- `X_TREND_ADMIN_API_BASE_URL` (default: `https://downloader-api.bhwa233.com`)
- `X_TREND_ADMIN_API_KEY`

Other optional X Trends variables:

- `X_TREND_TARGET_URL` (default: `https://x.com/explore/tabs/trending`)
- `X_TREND_BROWSER_EXECUTABLE_PATH`
- `X_TREND_LOCALE`
- `X_TREND_TARGETS_JSON`

`X_TREND_TARGETS_JSON` can be used to prepare multi-region serial crawling. Each item supports:

- `regionKey`
- `regionLabel` (optional override; usually unnecessary)
- `cookieSource`
- `storageStatePath`
- `adminApiBaseUrl`
- `adminApiKey`
- `targetUrl`
- `browserExecutablePath`
- `locale`

Built-in region labels currently include:

- `hk` -> `Hong Kong`
- `tw` -> `Taiwan`
- `jp` -> `Japan`
- `kr` -> `South Korea`
- `sg` -> `Singapore`
- `us` -> `United States`
- `gb` -> `United Kingdom`
- `au` -> `Australia`
- `ca` -> `Canada`
- `de` -> `Germany`
- `fr` -> `France`
- `br` -> `Brazil`
- `in` -> `India`
- `id` -> `Indonesia`
- `th` -> `Thailand`
- `my` -> `Malaysia`
- `ph` -> `Philippines`
- `vn` -> `Vietnam`
- `tr` -> `Turkey`
- `global` -> `Global`

For GitHub Actions hourly crawl, add these repository secrets:

- `X_TREND_REGION_KEY`
- `X_TREND_ADMIN_API_BASE_URL`
- `X_TREND_ADMIN_API_KEY`
- `X_TREND_LOCALE` (optional)

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
pnpm crawl:youtube:trending -- --max-results=100
pnpm crawl:youtube:trending -- --dry-run

pnpm crawl:youtube:live
pnpm crawl:youtube:live -- --max-results=200 --search-pages=4 --retention-days=30 --query=live
pnpm crawl:youtube:live -- --dry-run

pnpm crawl:x:trending
pnpm crawl:x:trending -- --dry-run
pnpm crawl:x:trending -- --hour="2026-03-28 11:00:00" --regions=hk
pnpm db:ensure:x:trends
```

Example local debug flow for X Trends:

```bash
# local file mode
export X_TREND_REGION_KEY=hk
export X_TREND_COOKIE_SOURCE=storage_state_file
export X_TREND_STORAGE_STATE_PATH=/path/to/x-storage-state.json
pnpm crawl:x:trending -- --dry-run
```

For CI / GitHub Actions, use `admin_api` mode. The crawler will always request the fixed target `x.com` from the admin API, then convert the returned cookie payload into Playwright `storageState` in memory.

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
- `.github/workflows/x-trending-crawl.yml`

The live workflow additionally runs `pnpm db:purge -- --days=30` after crawling (live snapshots only; trending snapshots are retained).

Required repository secrets:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `YOUTUBE_API_KEY_DAILY`
- `YOUTUBE_API_KEY_LIVE`
