# 今天去哪？ iPhone 機票優惠搜尋

## 功能
- 台灣 TPE / TSA / RMQ / KHH 出發
- 選國家，一次搜尋該國主要機場
- 單程 / 來回
- 只看直飛
- 預算上限
- 每個目的地只保留當次搜尋最低價，再由便宜到貴排序
- PWA：Safari 可「加入主畫面」

## 使用方式（建議 Vercel）
1. 到 Duffel 建立帳號並取得 Access Token。
2. 將整個資料夾上傳 GitHub。
3. 到 Vercel 匯入此 GitHub repository。
4. Vercel → Project → Settings → Environment Variables 新增：
   `DUFFEL_ACCESS_TOKEN=你的 token`
5. Deploy。
6. iPhone Safari 開啟 Vercel 網址 → 分享 → 加入主畫面。

## 注意
- Duffel 測試 token (`duffel_test_...`) 主要用於開發，測試模式價格/時刻不保證真實。
- 真正即時票價需使用 Duffel live mode。
- 航空票價會變動，正式訂購前應再次取得最新 offer。
- 這個版本不直接下單，只做搜尋與排序。
