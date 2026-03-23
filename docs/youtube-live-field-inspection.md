# YouTube Live Field Inspection

Inspection date: 2026-03-22  
Context: fetched 1 page of YouTube live results using the current project API key and query strategy.

## Request shape

### 1. Search request

Endpoint:

```text
GET /youtube/v3/search
```

Params:

```text
part=snippet
type=video
eventType=live
order=viewCount
q=live
maxResults=50
```

Observed result count:

```text
25 items
```

### 2. Detail request

Endpoint:

```text
GET /youtube/v3/videos
```

Params:

```text
part=snippet,statistics,contentDetails,liveStreamingDetails
id=<video ids from search page>
```

Observed result count:

```text
25 items
```

## Observed fields

### search.list item fields

```text
etag
id
id.kind
id.videoId
kind
snippet
snippet.channelId
snippet.channelTitle
snippet.description
snippet.liveBroadcastContent
snippet.publishTime
snippet.publishedAt
snippet.thumbnails
snippet.thumbnails.default
snippet.thumbnails.default.height
snippet.thumbnails.default.url
snippet.thumbnails.default.width
snippet.thumbnails.high
snippet.thumbnails.high.height
snippet.thumbnails.high.url
snippet.thumbnails.high.width
snippet.thumbnails.medium
snippet.thumbnails.medium.height
snippet.thumbnails.medium.url
snippet.thumbnails.medium.width
snippet.title
```

### videos.list item fields

```text
contentDetails
contentDetails.caption
contentDetails.contentRating
contentDetails.definition
contentDetails.dimension
contentDetails.duration
contentDetails.licensedContent
contentDetails.projection
etag
id
kind
liveStreamingDetails
liveStreamingDetails.activeLiveChatId
liveStreamingDetails.actualStartTime
liveStreamingDetails.concurrentViewers
liveStreamingDetails.scheduledStartTime
snippet
snippet.categoryId
snippet.channelId
snippet.channelTitle
snippet.defaultAudioLanguage
snippet.defaultLanguage
snippet.description
snippet.liveBroadcastContent
snippet.localized
snippet.localized.description
snippet.localized.title
snippet.publishedAt
snippet.tags
snippet.tags[]
snippet.thumbnails
snippet.thumbnails.default
snippet.thumbnails.default.height
snippet.thumbnails.default.url
snippet.thumbnails.default.width
snippet.thumbnails.high
snippet.thumbnails.high.height
snippet.thumbnails.high.url
snippet.thumbnails.high.width
snippet.thumbnails.maxres
snippet.thumbnails.maxres.height
snippet.thumbnails.maxres.url
snippet.thumbnails.maxres.width
snippet.thumbnails.medium
snippet.thumbnails.medium.height
snippet.thumbnails.medium.url
snippet.thumbnails.medium.width
snippet.thumbnails.standard
snippet.thumbnails.standard.height
snippet.thumbnails.standard.url
snippet.thumbnails.standard.width
snippet.title
statistics
statistics.commentCount
statistics.favoriteCount
statistics.likeCount
statistics.viewCount
```

## Category inspection

Conclusion:

```text
Yes. Live videos do have snippet.categoryId in videos.list.
```

Observed counts on this page:

```text
categoryId present: 25
categoryId missing: 0
```

Observed category IDs from sample items:

```text
10
24
25
27
```

US videoCategories mapping for the observed IDs:

```text
10 = Music
24 = Entertainment
25 = News & Politics
27 = Education
```

## Example rows

| videoId | title | categoryId | defaultLanguage | defaultAudioLanguage | concurrentViewers |
|---|---|---:|---|---|---:|
| `kSq71k8k5l8` | Live: Maa Vaishno Devi Aarti From Bhawan \| माता वैष्णो देवी आरती \| 22 March 2026 | 10 | hi | hi | 96230 |
| `xWXpl7azI8k` | البث المباشر لقناة الحدث AlHadath Live Stream | 25 | ar | ar | 28327 |
| `T4hhGO8G66A` | 🔴 Makkah Live \| مكة مباشر \| الحرم المكي مباشر... | 27 | ar | ar | 21064 |
| `_AthHIkMSBU` | US and Israel Attack Iran - LIVE Breaking News Coverage & War Updates | 25 | en-US | en | 19364 |
| `KDHuWBb2kps` | Kapamilya Online Live \| March 22, 2026 | 24 | en | fil | 5583 |

## Practical implication for this project

- The current live crawler can add category support without changing the search step.
- Category data should be read from `videos.list -> snippet.categoryId`.
- If the UI needs readable category names, add one category mapping step using `videoCategories.list`.
- Because the live ranking is global, category title mapping should use one fixed region baseline, such as `US`, to keep the mapping consistent.
