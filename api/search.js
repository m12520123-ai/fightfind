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
  res.status(status)
    .setHeader("Content-Type", "application/json; charset=utf-8")
    .send(JSON.stringify(body));
}

async function travelpayoutsSearch({
  token,
  origin,
  destination,
  date,
  returnDate,
  direct
}) {
  const params = new URLSearchParams({
    origin,
    destination,
    departure_at: date,
    currency: "twd",
    sorting: "price",
    direct: direct ? "true" : "false",
    limit: "30",
    page: "1",
    unique: "false",
    one_way: returnDate ? "false" : "true",
    token
  });

  if (returnDate) {
    params.set("return_at", returnDate);
  }

  const url =
    "https://api.travelpayouts.com/aviasales/v3/prices_for_dates?" +
    params.toString();

  const resp = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  const payload = await resp.json().catch(() => ({}));

  if (!resp.ok || payload?.success === false) {
    throw new Error(
      payload?.error ||
      payload?.message ||
      `Travelpayouts API ${resp.status}`
    );
  }

  const rows = Array.isArray(payload?.data) ? payload.data : [];

  return rows.map(item => ({
    amount: Number(item.price),
    currency: (payload.currency || "twd").toUpperCase(),
    airline: item.airline || "航空公司",
    flightNumber: item.flight_number || "",
    stops:
      typeof item.transfers === "number"
        ? item.transfers
        : typeof item.number_of_changes === "number"
        ? item.number_of_changes
        : null,
    departAt: item.departure_at || null,
    arriveAt: null,
    duration: item.duration || null,
    baggage: "依訂票平台票價方案",
    expiresAt: null,
    foundAt: item.found_at || null,
    link: item.link
      ? `https://www.aviasales.com/search/${item.link.replace(/^\//, "")}`
      : null
  }));
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;

  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;

      try {
        out[idx] = await fn(items[idx]);
      } catch (e) {
        out[idx] = { error: e.message };
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(limit, items.length) },
      worker
    )
  );

  return out;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const token = process.env.TRAVELPAYOUTS_TOKEN;

  if (!token) {
    return json(res, 500, {
      error: "尚未設定 TRAVELPAYOUTS_TOKEN"
    });
  }

  const {
    origin = "TPE",
    country = "JP",
    date,
    returnDate = "",
    direct = false,
    budget = 0
  } = req.body || {};

  if (!date) {
    return json(res, 400, {
      error: "請選擇出發日期"
    });
  }

  const destinations = DESTINATIONS[country];

  if (!destinations) {
    return json(res, 400, {
      error: "目前尚未支援這個國家"
    });
  }

  const batches = await mapLimit(
    destinations,
    4,
    async ([iata, city]) => {
      const offers = await travelpayoutsSearch({
        token,
        origin,
        destination: iata,
        date,
        returnDate: returnDate || null,
        direct
      });

      const filtered = offers.filter(item => {
        if (direct && item.stops !== 0) return false;
        if (budget && item.amount > Number(budget)) return false;
        return true;
      });

      const best = filtered.sort(
        (a, b) => a.amount - b.amount
      )[0];

      return best
        ? {
            ...best,
            destination: iata,
            city
          }
        : null;
    }
  );

  const results = batches
    .filter(x => x && !x.error)
    .sort((a, b) => a.amount - b.amount);

  const errors = batches
    .filter(x => x?.error)
    .map(x => x.error);

  return json(res, 200, {
    origin,
    country,
    date,
    returnDate: returnDate || null,
    searched: destinations.length,
    results,
    warnings: [...new Set(errors)].slice(0, 5),
    source: "Travelpayouts / Aviasales Data API",
    cachedPriceData: true,
    generatedAt: new Date().toISOString()
  });
}
