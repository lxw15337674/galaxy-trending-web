我已经全面掌握了项目的现状。基于您的项目需求和技术背景，我建议从以
  下几个维度进行优化和修复。在我们开始编写代码前，请您确认这些方案的
  优先级：


  1. 核心 Bug 修复：服务端水合与 SEO 优化
   * 当前问题：html 标签硬编码了
     lang="zh-CN"；日期和数字格式化在服务端与客户端不一致，导致水合 
     错误（Hydration Mismatch）。
   * 探讨方案：
       * Surgical Fix：在 layout.tsx 中通过 headers()
         动态检测路径，从而在服务端设置正确的 html lang。
       * Robust Fix：将路由重构为 app/[lang]/... 形式，这是 Next.js 
         推荐的 i18n 实践，能彻底解决多语言路径下的属性一致性问题。 


  2. 代码架构优化：消除冗余
   * 当前问题：中文和英文版的页面（如
     youtube-live/page.tsx）代码几乎完全重复。
   * 探讨方案：提取统一的页面组件，通过 Props 传递
     locale，实现“一份代码，多处渲染”，极大降低后续维护成本。       

  4. 性能与存储优化
   * 图片加载：目前视频封面均未设置 priority，导致首屏 LCP
     较慢。我建议为 Top 5 的视频设置优先级加载。
   * DB 瘦身：目前每个 Snapshot 都存储完整的 rawPayload，这会导致   
     Turso 数据库膨胀。建议仅在 failed 状态下保留 Payload 用于排障。
   * 边缘缓存：在响应头中加入 Cache-Control，利用 Cloudflare CDN    
     缓存榜单数据，提升访问速度。


  您希望先从哪一个部分入手？是优先解决 i18n/水合
  Bug，还是先尝试引入“全息”视觉风格？
