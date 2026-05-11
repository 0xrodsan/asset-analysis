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
  "ibovespa":     "^BVSP",

  // European Indices
  "dax":          "^GDAXI",
  "ftse100":      "^FTSE",
  "cac40":        "^FCHI",
  "ibex35":       "^IBEX",
  "eurostoxx":    "^STOXX50E",

  // Asian Indices
  "nikkei":       "^N225",
  "hangseng":     "^HSI",
  "shanghai":     "000001.SS",
  "kospi":        "^KS11",
  "asx200":       "^AXJO",

  // Mundo currencies
  "usddkk":       "DKK=X",
  "usdnok":       "NOK=X",
  "usdhuf":       "HUF=X",
  "nzdusd":       "NZDUSD=X",
  "usdhkd":       "HKD=X",
  "usdtwd":       "TWD=X",
  "usdils":       "ILS=X",
  "usdphp":       "PHP=X",

  // Emergentes
  "usdars":       "ARS=X",
  "usdaud":       "AUDUSD=X",
  "usdbrl":       "BRL=X",
  "usdclp":       "CLP=X",
  "usdcny":       "CNY=X",
  "usdmxn":       "MXN=X",
  "usdtry":       "TRY=X",
  "usdzar":       "ZAR=X",
  "usdinr":       "INR=X",
  "usdkrw":       "KRW=X",
  "usdrub":       "RUB=X",

  // Cesta DX
  "dxy":          "DX-Y.NYB",
  "usdeur":       "EURUSD=X",
  "usdjpy":       "JPY=X",
  "usdgbp":       "GBPUSD=X",
  "usdcad":       "CAD=X",
  "usdsek":       "SEK=X",
  "usdchf":       "CHF=X",

  // Commodities
  "gold":         "GC=F",
  "silver":       "SI=F",
  "wti":          "CL=F",
  "brent":        "BZ=F",
  "copper":       "HG=F",

  // Other
  "us2y":         "^IRX",
  "us10y":        "^TNX",
  "ewz":          "EWZ",
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

function updateRow(id, price, change) {
  const row = document.querySelector(`tr[data-id="${id}"]`);
  if (!row) return;
  const priceCell = row.querySelector(".asset-price");
  const changeCell = row.querySelector(".asset-change");
  if (priceCell) priceCell.textContent = price;
  if (changeCell) {
    changeCell.textContent = change;
    const n = parseFloat(change);
    if (Number.isNaN(n)) {
      changeCell.className = "asset-change";
    } else {
      changeCell.className = "asset-change " + (n >= 0 ? "positive" : "negative");
    }
  }
}

function updateSentimentRow(id, value, label) {
  const row = document.querySelector(`tr[data-id="${id}"]`);
  if (!row) return;
  const priceCell = row.querySelector(".asset-price");
  const changeCell = row.querySelector(".asset-change");
  if (priceCell) priceCell.textContent = `${value} / 100`;
  if (changeCell) {
    changeCell.textContent = label;
    changeCell.className = "asset-change";
  }
}

function markRowError(id) {
  updateRow(id, "—", "unavailable");
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
        updateRow(id, formatPrice(price), formatChange(change));
      } catch (err) {
        console.warn(`Yahoo fetch failed for ${id} (${ticker}):`, err);
        markRowError(id);
      }
    })
  );
}

async function loadBitcoin() {
  try {
    const data = await fetchJSON(COINGECKO_URL);
    const btc = data?.bitcoin;
    if (!btc) throw new Error("No data");
    updateRow("bitcoin", formatPrice(btc.usd), formatChange(btc.usd_24h_change));
  } catch (err) {
    console.warn("CoinGecko fetch failed:", err);
    markRowError("bitcoin");
  }
}

async function loadFearGreed() {
  try {
    const data = await fetchJSON(FNG_URL);
    const entry = data?.data?.[0];
    if (!entry) throw new Error("No data");
    const value = Number(entry.value);
    const label = (entry.value_classification ?? "—").toUpperCase();
    updateSentimentRow("fear-greed", Number.isNaN(value) ? "—" : String(value), label);
  } catch (err) {
    console.warn("Fear & Greed fetch failed:", err);
    markRowError("fear-greed");
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
