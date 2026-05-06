# YouTube Hot 日聚合方案

更新时间：2026-05-06

## 目标

把当前面向用户的 `youtube_hot` 从“6 小时快照模型”切换为“按天聚合模型”。

切换后，产品不再表现为“展示最近一次 6 小时榜单”，而是表现为“展示某一天的日榜”，同时尽量保持现在页面的排序感受和产品行为。

## 当前状态

当前 `youtube_hot` 的实际行为：

- 爬虫每 6 小时运行一次
- 数据写入以下三张表：
  - `youtube_hot_hourly_batches`
  - `youtube_hot_hourly_snapshots`
  - `youtube_hot_hourly_items`
- 页面和 API 只查询最近一个成功发布的 batch
- 路由名虽然叫 history，但本质上只是最近一个 batch 的分页，不是真正的时间历史

当前排序语义：

- 地区页：
  - 按最近一次快照里的 `rank` 排序
- 全球页：
  - 在最近一次快照内按跨地区覆盖度做聚合
  - 按地区覆盖数和聚合分数排序

## 产品决策

采用方案 A：

- 每条日记录的粒度为：
  - `snapshot_date + region_code + video_id`
- 不再对用户暴露 hourly snapshot 查询路径
- 同一天内，同地区、同视频在多次小时抓取中出现时，只合并为 1 条日记录

这样可以保住地区页，同时最大程度保留当前产品体验。

## 日聚合口径

### 地区日记录

对于一条 `snapshot_date + region_code + video_id`，把该视频在这一天、这个地区内出现过的所有 hourly 行聚合成一条 daily 行。

建议保留这些字段：

- `snapshot_date`
- `region_code`
- `region_name`
- `video_id`
- `video_url`
- `title`
- `thumbnail_url`
- `category_id`
- `category_title`
- `published_at`
- `duration_iso`
- `channel_id`
- `channel_title`
- `channel_url`
- `channel_avatar_url`
- `subscriber_count`
- `hidden_subscriber_count`
- `max_view_count`
- `max_like_count`
- `max_comment_count`
- `last_rank`
- `best_rank`
- `appearances`
- `first_seen_at`
- `last_seen_at`
- `metadata_json`

字段语义：

- `last_rank`
  - 这一天最后一次成功抓取到该视频时的 rank
- `best_rank`
  - 这一天该视频在这个地区出现过的最好名次，也就是 `min(rank)`
- `appearances`
  - 这一天该视频在这个地区被成功抓到的次数
- `first_seen_at`
  - 这一天第一次抓到它的时间
- `last_seen_at`
  - 这一天最后一次抓到它的时间
- `max_view_count`
  - 这一天观察到的最大 `view_count`
- `max_like_count`
  - 这一天观察到的最大 `like_count`
- `max_comment_count`
  - 这一天观察到的最大 `comment_count`
- 展示字段如 `title`、`thumbnail_url`、`channel_*`
  - 取这一天最后一次成功抓取时的值

### 地区页排序

地区日榜建议使用：

1. `last_rank ASC`
2. `appearances DESC`
3. `best_rank ASC`
4. `video_id ASC`

原因：

- `last_rank` 最接近当前“最新榜单”的体验
- `appearances` 能体现它在当天的稳定上榜程度
- `best_rank` 可以作为有用的次级排序

### 全球日榜

全球榜不应该直接对所有 hourly 行做聚合。

建议两步处理：

1. 先按地区规则，得到每个地区当天的最终日记录
2. 再把这些地区最终记录按 `snapshot_date + video_id` 做跨地区聚合

全球聚合字段：

- `aggregate_region_count`
- `aggregate_region_codes`
- `aggregate_region_names`
- `aggregate_best_rank`
- `aggregate_avg_rank`
- `aggregate_score`

建议的分数规则：

- 每个地区贡献：
  - 当 `last_rank <= 100` 时，取 `101 - last_rank`
  - 否则取 `1`
- 对所有地区贡献求和，得到 `aggregate_score`

全球页排序：

1. `aggregate_region_count DESC`
2. `aggregate_score DESC`
3. `aggregate_best_rank ASC`
4. `video_id ASC`

原因：

- 这样最接近当前全球榜的产品感觉
- 只是时间口径从“最新一个小时快照”切换成了“当天收盘后的跨地区聚合”

## 存储模型

### 面向用户的新数据源

引入 daily 表，作为新的对外查询源：

- `youtube_hot_daily_snapshots`
- `youtube_hot_daily_items`

推荐结构：

- `youtube_hot_daily_snapshots`
  - 每天一条
- `youtube_hot_daily_items`
  - 每个 `snapshot_date + region_code + video_id` 一条

建议唯一键：

- snapshot 表：
  - `snapshot_date`
- item 表：
  - `snapshot_id, region_code, video_id`

建议索引：

- daily snapshots：
  - `(snapshot_date)`
  - `(status, snapshot_date)`
- daily items：
  - `(snapshot_id, region_code, last_rank)`
  - `(snapshot_id, video_id)`
  - `(snapshot_id, category_id)`
  - `(region_code, snapshot_id)`

## 写入路径

### 爬取频率

这一阶段不改爬虫频率：

- 仍然每 6 小时抓一次

原因：

- 这一轮主要解决存储模型和查询口径
- 频率是否从 6 小时改成 12 小时，应该作为单独决策处理

### 日聚合写入策略

每次 hourly crawl 成功后：

1. 从小时批次时间推导出 `snapshot_date`
2. upsert 当天的 daily snapshot 行
3. 对每个成功地区结果：
   - 按 `region_code + video_id` upsert daily item
4. 更新 daily item 字段：
   - 展示字段用当天最后一次抓取值覆盖
   - `last_rank` 用当天最后一次抓取值
   - `best_rank = min(existing.best_rank, incoming.rank)`
   - `appearances` 自增
   - 首次插入时设置 `first_seen_at`
   - 每次更新 `last_seen_at`
   - 更新各类 max 统计字段
5. 回写 daily snapshot 汇总信息

注意：

- 同一个小时的重复重跑不能把 `appearances` 重复累加
- daily 聚合应该统计“成功小时抓取次数”，而不是“重试次数”

为了安全支持这点，daily 写入不建议采用纯增量 `counter += 1` 模式。

推荐实现为“按天确定性重建”：

- 每次 hourly 任务结束后，触发一个 daily 聚合脚本
- 脚本只查询当天 `snapshot_date` 下的全部 hourly 源数据
- 基于这些源数据重新计算当天 daily 结果
- 然后覆盖写回当天的 `youtube_hot_daily_*` 数据

这样做的优点：

- 不会因为同一个小时重跑而重复累计 `appearances`
- 不依赖复杂的 source key 去重状态
- 比纯增量更新更容易保证正确性
- 不需要每次重算所有历史，只重算当天，成本可控

推荐落地方式：

- daily 聚合脚本按 `snapshot_date` 进行局部重建
- 写入策略采用：
  - `replace daily rows for one snapshot_date`

这比“全量历史重建”便宜很多，也比“单条增量合并”更稳。

### 时区口径

daily 聚合必须明确 `snapshot_date` 的时区口径，避免 0 点前后归属不一致。

推荐统一使用：

- `UTC`

原因：

- `youtube_hot` 是全球多地区榜单，不适合按单一地区本地时区切日
- `UTC` 更容易保证爬虫、聚合、查询、回填和 retention 的一致性
- 后续 SQL 聚合、补数据和排障时解释成本最低

注意：

- 调度环境可以继续使用 `TZ: Asia/Shanghai`
- 但 `youtube_hot_daily.snapshot_date` 的业务归属必须按 `UTC date` 计算
- 文档、SQL 和代码实现都要使用同一个 UTC 口径，不能混用本地时区

## 查询路径

### 地区页

把当前查询从：

- 最新 hourly batch

切换为：

- 最新 daily snapshot

保留现有筛选能力：

- region
- category
- sort
- pagination

其中地区页默认排序要映射到 daily 语义：

- `rank_asc` 对应 `last_rank ASC`

### 全球页

全球页查询不再从 hourly 行聚合，而是从 daily 地区最终行聚合。

这样仍然保留：

- 地区覆盖数
- 分数排序
- 分类筛选

但底层依据变成“一天内每个地区的最终结果”。

### 全球榜计算方式

不建议在 `youtube_hot_daily_items` 上冗余以下字段：

- `global_score`
- `global_region_count`

原因：

- 这两个值不是 item 自身属性，而是“同一天跨地区聚合后的结果”
- 如果冗余到 item 行，会让补数据、重跑、修复和回填时的一致性成本变高
- 后续某个地区的日记录变化时，会引发额外联动更新

当前推荐做法：

- 维持 daily item 为地区级事实表
- 全球榜在查询时基于 daily item 聚合生成
- 通过合理索引覆盖全球榜查询

可选后续优化：

- 如果后续确认全球榜查询成本过高，再考虑单独引入：
  - `youtube_hot_daily_global_items`
  - 或者 `youtube_hot_daily_snapshots.global_trending_data_json`

但第一阶段不建议做这类冗余缓存。

## 保留策略

当前决策采用短期保留策略：

- `youtube_hot_hourly_*` 保留 3 天
- `youtube_hot_daily_*` 保留 30 天

原因：

- `hourly` 只作为短期排障、回查和聚合校验数据
- `daily` 作为面对用户的近期历史模型
- 当前产品目标是近期热点，不以季度或年度回溯分析为目标

这意味着：

- 最近 3 天内仍可回放小时级榜单
- 最近 30 天内可查看日榜和近 30 天趋势
- 超过 30 天后，`youtube_hot` 不再保留用户可查询的历史结果

## 迁移步骤

### 第一阶段

先补 daily schema 和写入链路，但不切页面读取。

目标：

- 开始持续生产 daily 聚合数据
- 页面继续稳定运行

### 第二阶段

从现有 hourly 数据回填 daily 表。

回填范围：

- 当前 retention 窗口内仍存在的全部 `youtube_hot_hourly_*` 数据

### 第三阶段

把以下读取全部切到 daily：

- 页面 SSR 数据
- API 路由
- filters
- 全球聚合逻辑

### 第四阶段

daily 稳定后，启用最终 retention：

- hourly 3 天
- daily 30 天

## 非目标

这一轮不包含：

- 日内小时回放 UI
- 小时级趋势图
- 对用户暴露每个小时的历史快照
- 把抓取频率从 6 小时改为 12 小时
- 第一阶段就完全删掉 hourly 存储

## Review 检查点

在开始实现前，需要确认以下几点：

1. daily 粒度采用 `snapshot_date + region_code + video_id`
2. 地区页主排序采用 `last_rank`
3. 全球页从“各地区当天最后记录”做聚合
4. 保留 `best_rank`、`appearances`、`first_seen_at`、`last_seen_at`
5. daily 作为 30 天近期历史模型，hourly 退化为 3 天短保留支持数据
