const CORS_PROXY = "https://corsproxy.io/?";
const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart/";
const COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true";
const FNG_URL = "https://api.alternative.me/fng/";
const REFRESH_MS = 60_000;

const TICKERS = {
  // Futures
  "sp500-fut":    "ES=F",
  "nasdaq-fut":   "NQ=F",
  "dowjones-fut": "YM=F",
  "russell-fut":  "RTY=F",

  // U.S. Indices
  "sp500":        "^GSPC",
  "nasdaq":       "^IXIC",
  "dowjones":     "^DJI",
  "russell2000":  "^RUT",
  "vix":          "^VIX",

  // Global Indices
  "ibovespa":     "^BVSP",
  "dax":          "^GDAXI",
  "ftse100":      "^FTSE",
  "nikkei":       "^N225",
  "hangseng":     "^HSI",

  // Fixed Income & FX
  "us2y":         "^IRX",
  "us10y":        "^TNX",
  "usdbrl":       "BRL=X",
  "usdeur":       "EURUSD=X",
  "usdjpy":       "JPY=X",
  "dxy":          "DX-Y.NYB",
  "ewz":          "EWZ",

  // Commodities
  "gold":         "GC=F",
  "silver":       "SI=F",
  "wti":          "CL=F",
  "brent":        "BZ=F",
  "copper":       "HG=F",
};

function formatPrice(value) {
  if (value == null || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const digits = abs >= 1000 ? 2 : abs >= 10 ? 2 : 4;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatChange(pct) {
  if (pct == null || Number.isNaN(pct)) return "unavailable";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function applyChangeClass(el, pct) {
  el.classList.remove("positive", "negative");
  if (pct == null || Number.isNaN(pct)) return;
  if (pct > 0) el.classList.add("positive");
  else if (pct < 0) el.classList.add("negative");
}

function updateCard(id, { price, change, label }) {
  const card = document.querySelector(`[data-id="${id}"]`);
  if (!card) return;

  const priceEl = card.querySelector('[data-role="price"]');
  const changeEl = card.querySelector('[data-role="change"]');
  const labelEl = card.querySelector('[data-role="label"]');

  if (priceEl) priceEl.textContent = price == null ? "—" : formatPrice(price);
  if (changeEl) {
    changeEl.textContent = formatChange(change);
    applyChangeClass(changeEl, change);
  }
  if (labelEl && label !== undefined) labelEl.textContent = label ?? "—";

  card.classList.remove("skeleton");
}

function markCardError(id) {
  const card = document.querySelector(`[data-id="${id}"]`);
  if (!card) return;

  const priceEl = card.querySelector('[data-role="price"]');
  const changeEl = card.querySelector('[data-role="change"]');

  if (priceEl) priceEl.textContent = "—";
  if (changeEl) {
    changeEl.textContent = "unavailable";
    changeEl.classList.remove("positive", "negative");
  }
  card.classList.remove("skeleton");
}

function setLastUpdated() {
  const el = document.getElementById("last-updated");
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
  });
  el.setAttribute("datetime", now.toISOString());
}

async function fetchJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchYahoo(ticker) {
  const target = `${YAHOO_BASE}${encodeURIComponent(ticker)}?interval=1d&range=1d`;
  const url = `${CORS_PROXY}${encodeURIComponent(target)}`;
  const data = await fetchJSON(url);
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error("No data");

  const meta = result.meta || {};
  const price = meta.regularMarketPrice ?? null;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? null;

  let change = null;
  if (price != null && prevClose != null && prevClose !== 0) {
    change = ((price - prevClose) / prevClose) * 100;
  }
  return { price, change };
}

async function loadYahoo() {
  await Promise.all(
    Object.entries(TICKERS).map(async ([id, ticker]) => {
      try {
        const { price, change } = await fetchYahoo(ticker);
        updateCard(id, { price, change });
      } catch (err) {
        console.warn(`Yahoo fetch failed for ${id} (${ticker}):`, err);
        markCardError(id);
      }
    })
  );
}

async function loadBitcoin() {
  try {
    const data = await fetchJSON(COINGECKO_URL);
    const btc = data?.bitcoin;
    if (!btc) throw new Error("No data");
    updateCard("bitcoin", {
      price: btc.usd,
      change: btc.usd_24h_change,
    });
  } catch (err) {
    console.warn("CoinGecko fetch failed:", err);
    markCardError("bitcoin");
  }
}

async function loadFearGreed() {
  try {
    const data = await fetchJSON(FNG_URL);
    const entry = data?.data?.[0];
    if (!entry) throw new Error("No data");
    const value = Number(entry.value);
    const label = entry.value_classification ?? "—";
    const card = document.querySelector('[data-id="fear-greed"]');
    if (card) {
      const priceEl = card.querySelector('[data-role="price"]');
      const changeEl = card.querySelector('[data-role="change"]');
      const labelEl = card.querySelector('[data-role="label"]');
      if (priceEl) priceEl.textContent = Number.isNaN(value) ? "—" : String(value);
      if (changeEl) {
        changeEl.textContent = "/ 100";
        changeEl.classList.remove("positive", "negative");
      }
      if (labelEl) labelEl.textContent = label;
      card.classList.remove("skeleton");
    }
  } catch (err) {
    console.warn("Fear & Greed fetch failed:", err);
    markCardError("fear-greed");
  }
}

async function refreshAll() {
  await Promise.allSettled([loadYahoo(), loadBitcoin(), loadFearGreed()]);
  setLastUpdated();
}

document.addEventListener("DOMContentLoaded", () => {
  refreshAll();
  setInterval(refreshAll, REFRESH_MS);
});
