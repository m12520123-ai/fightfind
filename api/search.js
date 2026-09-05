const DESTINATIONS = {
  JP: [
    ["NRT","東京成田"],["HND","東京羽田"],["KIX","大阪關西"],["OKA","沖繩"],
    ["FUK","福岡"],["CTS","札幌新千歲"],["NGO","名古屋"],["SDJ","仙台"],
    ["KMJ","熊本"],["KOJ","鹿兒島"],["HIJ","廣島"],["TAK","高松"],
    ["MYJ","松山"],["KMQ","小松"],["OIT","大分"],["NGS","長崎"]
  ],
  KR: [["ICN","首爾仁川"],["GMP","首爾金浦"],["PUS","釜山"],["CJU","濟州"],["TAE","大邱"],["CJJ","清州"]],
  TH: [["BKK","曼谷蘇凡納布"],["DMK","曼谷廊曼"],["CNX","清邁"],["HKT","普吉"],["KBV","喀比"]],
  VN: [["SGN","胡志明市"],["HAN","河內"],["DAD","峴港"],["PQC","富國島"],["CXR","芽莊"]],
  PH: [["MNL","馬尼拉"],["CEB","宿霧"],["CRK","克拉克"],["DVO","達沃"],["PPS","公主港"]],
  HK: [["HKG","香港"]],
  MO: [["MFM","澳門"]],
  SG: [["SIN","新加坡"]],
  MY: [["KUL","吉隆坡"],["PEN","檳城"],["BKI","亞庇"],["JHB","新山"]],
  ID: [["DPS","峇里島"],["CGK","雅加達"],["SUB","泗水"]]
};

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").send(JSON.stringify(body));
}

async function duffelSearch({ token, origin, destination, date, returnDate, direct }) {
  const slices = [{ origin, destination, departure_date: date }];
  if (returnDate) slices.push({ origin: destination, destination: origin, departure_date: returnDate });

  const resp = await fetch("https://api.duffel.com/air/offer_requests?return_offers=true&supplier_timeout=10000", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Duffel-Version": "v2",
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({
      data: {
        slices,
        passengers: [{ type: "adult" }],
        cabin_class: "economy",
        ...(direct ? { max_connections: 0 } : {})
      }
    })
  });

  const payload = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = payload?.errors?.[0]?.message || `Duffel API ${resp.status}`;
    throw new Error(msg);
  }

  const offers = payload?.data?.offers || [];
  return offers.map(offer => {
    const outbound = offer.slices?.[0];
    const firstSeg = outbound?.segments?.[0];
    const lastSeg = outbound?.segments?.[outbound.segments.length - 1];
    const airline = offer.owner?.name || firstSeg?.operating_carrier?.name || "航空公司";
    const stops = Math.max(0, (outbound?.segments?.length || 1) - 1);
    const baggage = offer.passengers?.[0]?.baggages?.map(b => `${b.quantity}×${b.type}`).join(", ") || "依票價方案";
    return {
      id: offer.id,
      amount: Number(offer.total_amount),
      currency: offer.total_currency,
      airline,
      stops,
      departAt: firstSeg?.departing_at || null,
      arriveAt: lastSeg?.arriving_at || null,
      duration: outbound?.duration || null,
      baggage,
      expiresAt: offer.expires_at || null
    };
  });
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      try { out[idx] = await fn(items[idx]); }
      catch (e) { out[idx] = { error: e.message }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  const token = process.env.DUFFEL_ACCESS_TOKEN;
  if (!token) return json(res, 500, { error: "尚未設定 DUFFEL_ACCESS_TOKEN" });

  const { origin = "TPE", country = "JP", date, returnDate = "", direct = false, budget = 0 } = req.body || {};
  if (!date) return json(res, 400, { error: "請選擇出發日期" });
  const destinations = DESTINATIONS[country];
  if (!destinations) return json(res, 400, { error: "目前尚未支援這個國家" });

  const batches = await mapLimit(destinations, 4, async ([iata, city]) => {
    const offers = await duffelSearch({ token, origin, destination: iata, date, returnDate: returnDate || null, direct });
    const filtered = offers.filter(x => !budget || x.amount <= Number(budget));
    const best = filtered.sort((a,b) => a.amount - b.amount)[0];
    return best ? { ...best, destination: iata, city } : null;
  });

  const results = batches.filter(x => x && !x.error).sort((a,b) => a.amount - b.amount);
  const errors = batches.filter(x => x?.error).map(x => x.error);
  return json(res, 200, {
    origin, country, date, returnDate: returnDate || null,
    searched: destinations.length,
    results,
    warnings: [...new Set(errors)].slice(0, 3),
    generatedAt: new Date().toISOString()
  });
}
