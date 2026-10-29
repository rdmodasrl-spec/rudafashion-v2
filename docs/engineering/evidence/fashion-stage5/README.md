# Fashion Stage 5 evidence (2026-10-28)

| File | What it proves |
| --- | --- |
| `editorial-rights.json` | Before/after mapping for the 14 seeded editorial posts: 10 replaced with RUDA-owned covers, 4 video posts withdrawn, original URLs kept |
| `desktop-01-trends.png`, `mobile-01-trends.png` | Trends page renders on 1440×900 and 390×844 |
| `desktop-02-feed.png`, `mobile-02-feed.png` | Feed renders after deploy |
| `desktop-05-creator.png`, `mobile-05-creator.png` | Creator profile loads real data |
| `desktop-08-season-filter.png`, `mobile-08-season-filter.png` | Season row: 全部季节 / 春季 / 夏季 / 秋季 / 冬季, 夏季 selected |
| `desktop-09-editorial-owned.png` | Feed shows the RUDA-owned editorial covers (no third-party imagery) |
| `admin-00-landing.png` | Admin console reachable at `https://admin.ruda.fashion` |
| `admin-01-governance-reports.png` | 社区治理 surface with the five tabs inside 时尚设计 → 我的素材 → 我的作品 |
| `admin-02-taxonomy.png` | 分类标签: real usage counts, 重命名/停用/合并 actions |
| `admin-03-users.png` | 违规用户: account search, 0/0 post counts, empty detail hint |
| `admin-04-media.png` | 媒体异常: status/stage filters and empty state |

Acceptance command:

```
FASHION_BASE_URL=http://127.0.0.1:3011 \
FASHION_SHOT_DIR=docs/engineering/evidence/fashion-stage5 \
node scripts/fashion-acceptance.mjs        # 14/14 pass
```

Admin screenshots are produced by `scripts/fashion-admin-shot.mjs` (logs in with the configured admin
credentials over the real `admin.ruda.fashion` host; the session cookie is not stored in the repository).
