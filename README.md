# Galaxy Trending Web

Multi-source trending site with:

- YouTube 视频榜（每 2 小时抓取，按地区）
- YouTube Music 热门歌曲周榜（官方 Weekly Top Songs，支持 Global 与国家榜）
- YouTube Music 视频日榜（官方 Top Videos Daily）
- YouTube Music Shorts 歌曲日榜（官方 Shorts Songs Daily）
- YouTube 直播榜（定时抓取，全局前 N）
- TikTok Hashtag Trends（按小时串行抓取多地区）
- TikTok Hot Videos（按小时串行抓取多地区，仅热门排序）
- X Trends（按小时抓取，默认按代码内维护的前 20 活跃地区串行抓取，同时保留 `X_TREND_TARGETS_JSON` 作为后续自定义多地区入口）

## Tech Stack

- vinext (Vite + App Router)
- Cloudflare Workers
- Turso (libSQL)
- Drizzle ORM

## Environment Variables

Required:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `NEXT_PUBLIC_SITE_URL`（生产模式必填，用于 canonical URL）
- `YOUTUBE_API_KEY_DAILY` (用于 `crawl:youtube:trending`)
- `YOUTUBE_API_KEY_LIVE` (用于 `crawl:youtube:live`)

YouTube Music crawler country envs:

- `YOUTUBE_MUSIC_WEEKLY_COUNTRY_CODES`
- `YOUTUBE_MUSIC_DAILY_VIDEO_COUNTRY_CODES`
- `YOUTUBE_MUSIC_DAILY_SHORTS_COUNTRY_CODES`
- `YOUTUBE_MUSIC_DAILY_COUNTRY_CODES`（旧兼容变量；daily 两条在新变量缺失时会回退到它）

For the current default X Trends crawler:

- default targets are stored in code as data
- current default target list is `['us', 'jp', 'id', 'in', 'gb', 'de', 'tr', 'mx', 'br', 'hk', 'sa', 'th', 'my', 'ph', 'vn', 'kr', 'tw', 'sg', 'ca', 'fr']`
- region labels and UI location selectors are resolved from the built-in region map
- crawler uses a single browser context and switches X Explore location serially

X Trends cookie source selection:

- `X_TREND_COOKIE_SOURCE`
  - `storage_state_file`: 从本地 Playwright `storageState` 文件读取 cookie，适合本地调试
  - `admin_api`: 从管理接口读取 X/Twitter cookie，优先请求 `website=x.com`，如不存在则自动回退到 `website=twitter.com`，适合 GitHub Actions / 线上定时抓取

If `X_TREND_COOKIE_SOURCE=storage_state_file`:

- `X_TREND_STORAGE_STATE_PATH`

If `X_TREND_COOKIE_SOURCE=admin_api`:

- `X_TREND_ADMIN_API_KEY`

Other optional X Trends variables:

- `X_TREND_TARGET_URL` (default: `https://x.com/explore/tabs/trending`)
- `X_TREND_BROWSER_EXECUTABLE_PATH`
- `X_TREND_LOCALE`
- `X_TREND_TARGETS_JSON`

For TikTok Hashtag Trends crawler:

- default targets are stored in code as `US / ID / BR / MX / PK / PH / VN / TR / SA / GB / JP / KR / TH / MY / SG / DE / FR / CA / AU / AE`
- current crawler uses TikTok Creative Center hashtag list API from a browser page context
- current default period is `7` days

Optional TikTok Hashtag Trends variables:

- `TIKTOK_TREND_TARGETS_JSON`
- `TIKTOK_TREND_LOCALE`
- `TIKTOK_TREND_PERIOD`
- `TIKTOK_TREND_INDUSTRY_IDS`
- `TIKTOK_TREND_KEYWORD`
- `TIKTOK_TREND_FILTER_BY`
- `TIKTOK_TREND_BROWSER_EXECUTABLE_PATH`

For TikTok hot videos crawler:

- default targets are stored in code
- current crawler runs serially across configured countries/scopes
- current default order is hot (`vv`)

Optional TikTok hot videos variables:

- `TIKTOK_VIDEO_TARGETS_JSON`
- `TIKTOK_VIDEO_LOCALE`
- `TIKTOK_VIDEO_BROWSER_EXECUTABLE_PATH`

`X_TREND_TARGETS_JSON` can be used for custom multi-region serial crawling. Each item supports:

- `regionKey`
- `regionLabel` (optional override)
- `locationSearchQuery` (optional override)
- `locationSelectText` (optional override)
- `cookieSource`
- `storageStatePath`
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
- `mx` -> `Mexico`
- `sa` -> `Saudi Arabia`
- `th` -> `Thailand`
- `my` -> `Malaysia`
- `ph` -> `Philippines`
- `vn` -> `Vietnam`
- `tr` -> `Turkey`

For GitHub Actions hourly crawl, add these repository secrets:

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

pnpm crawl:youtube:music:weekly
pnpm crawl:youtube:music:weekly -- --countries=global,US,JP
pnpm crawl:youtube:music:weekly -- --dry-run

pnpm crawl:youtube:music:videos:daily
pnpm crawl:youtube:music:videos:daily -- --countries=global,US,JP
pnpm crawl:youtube:music:videos:daily -- --dry-run

pnpm crawl:youtube:music:shorts:daily
pnpm crawl:youtube:music:shorts:daily -- --countries=global,US,JP
pnpm crawl:youtube:music:shorts:daily -- --dry-run

pnpm crawl:youtube:live
pnpm crawl:youtube:live -- --max-results=200 --search-pages=4 --retention-days=30 --query=live
pnpm crawl:youtube:live -- --dry-run

pnpm crawl:x:trending
pnpm crawl:x:trending -- --dry-run
pnpm crawl:x:trending -- --hour="2026-03-28 11:00:00" --regions=us,jp

pnpm spike:tiktok:hashtag
pnpm crawl:tiktok:hashtag -- --countries=US,JP --detail-limit=0 --json-only
pnpm crawl:tiktok:hashtag -- --countries=US --detail-limit=2

pnpm crawl:tiktok:videos -- --countries=US,JP --periods=7 --sort=vv
pnpm crawl:tiktok:videos -- --dry-run
```

Example local debug flow for X Trends:

```bash
# local file mode
export X_TREND_COOKIE_SOURCE=storage_state_file
export X_TREND_STORAGE_STATE_PATH=/path/to/x-storage-state.json
pnpm crawl:x:trending -- --dry-run
```

For CI / GitHub Actions, use `admin_api` mode. The crawler will first request `x.com` from `https://dev-api.bhwa233.com/api/admin/gist-cookie`, and automatically fall back to `twitter.com` when the admin API does not have an `x.com` entry. The returned payload is then converted into Playwright `storageState` in memory.

## API

- `GET /api/youtube-hot-history?page=1&pageSize=20`
- `GET /api/youtube-hot-history/filters`
- `GET /api/db-health`

## Time Semantics

- `snapshot_hour`: 统计小时（Asia/Shanghai），用于榜单聚合与时间筛选。
- `fetched_at` / `crawled_at`: 抓取入库时间（UTC ISO 8601）。

## GitHub Actions

- `.github/workflows/youtube-trending-crawl.yml`
- `.github/workflows/youtube-music-weekly-crawl.yml`
- `.github/workflows/youtube-music-videos-daily-crawl.yml`
- `.github/workflows/youtube-music-shorts-daily-crawl.yml`
- `.github/workflows/youtube-live-crawl.yml`
- `.github/workflows/db-migrate.yml`
- `.github/workflows/x-trending-crawl.yml`
- `.github/workflows/tiktok-hashtag-crawl.yml`
- `.github/workflows/tiktok-videos-crawl.yml`
- `.github/workflows/ci.yml`

The live workflow additionally runs `pnpm db:purge -- --days=30` after crawling (live snapshots only; trending snapshots are retained).
Schema migrations are run manually via `.github/workflows/db-migrate.yml`, so scheduled crawlers are not blocked by Drizzle migration failures.

Required repository secrets:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `NEXT_PUBLIC_SITE_URL`
- `YOUTUBE_API_KEY_DAILY`
- `YOUTUBE_API_KEY_LIVE`
- `X_TREND_ADMIN_API_KEY`

