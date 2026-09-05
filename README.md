# Fightfind v5

新增：
- 國家選單之外，可指定「目的機場」
- 選「全部主要機場」時維持整國掃描
- 選指定機場時，只搜尋該機場
- 新增「低價月曆月份」
- 指定機場後，下方顯示該月 1～31 日每天最低參考價
- 月曆使用 Travelpayouts `/v2/prices/month-matrix`
- 每個目的地最多列出 8 家航空公司的最低價
- 保留促銷／異常低價區
- PWA 快取升級 v5

Vercel 環境變數維持：
TRAVELPAYOUTS_TOKEN = 你的 Travelpayouts API Token

解壓後全部覆蓋 GitHub fightfind repo，Commit 到 main，等 Vercel Ready。
