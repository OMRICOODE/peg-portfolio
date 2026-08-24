const fmt = (n) =>
  n == null || Number.isNaN(n)
    ? "—"
    : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const fmtPct = (n) => (n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`);

const RANGE_ORDER = ["1d", "1w", "1m", "6m", "1y", "5y"];
let chartData = null;
let activeRange = "1d";

/** Resolve API base: FastAPI (/api/portfolio) or static Pages (/api/portfolio.json) */
async function apiGet(path) {
  const candidates = [
    `api/${path}`,
    `api/${path}.json`,
    `/api/${path}`,
    `/api/${path}.json`,
  ];
  let lastErr;
  for (const u of candidates) {
    try {
      const res = await fetch(`${u}?t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) return res.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("API failed");
}

function renderHero(d) {
  document.getElementById("totalValue").textContent = fmt(d.total_value);
  const ret = document.getElementById("returnChip");
  ret.textContent = fmtPct(d.return_pct);
  ret.className = "chip " + (d.return_pct >= 0 ? "pos" : "neg");
  document.getElementById("taxChip").textContent = `מס: ${fmt(d.total_taxes_paid)}`;
  document.getElementById("dateChip").textContent = d.last_update || "—";
}

function renderHoldings(d) {
  const el = document.getElementById("holdings");
  if (!d.positions?.length) {
    el.innerHTML = '<p class="loading">אין פוזיציות</p>';
    return;
  }
  el.innerHTML =
    `<div class="section-title">${d.positions.length} החזקות</div>` +
    d.positions
      .map(
        (p) => `
    <article class="card">
      <div class="card-head">
        <div>
          <div class="ticker">${p.ticker}</div>
          <div class="name">${p.name || ""}</div>
        </div>
        <span class="peg-badge">PEG ${p.peg_now ?? p.peg_entry}</span>
      </div>
      <div class="card-grid">
        <div><span>שווי</span><strong>${fmt(p.market_value)}</strong></div>
        <div><span>רווח</span><strong class="${p.gain >= 0 ? "pos" : "neg"}">${fmtPct(p.gain_pct)}</strong></div>
        <div><span>מחיר</span><strong>$${p.price}</strong></div>
        <div><span>יעד</span><strong>$${p.p_target}</strong></div>
        <div><span>ליעד</span><strong>${fmtPct(p.to_target_pct)}</strong></div>
        <div><span>חודשים</span><strong>${p.months_held ?? 0}/24</strong></div>
      </div>
    </article>`
      )
      .join("");
}

function renderTop20(d) {
  const el = document.getElementById("top20");
  el.innerHTML =
    `<div class="section-title">הכי זולות PEG היום</div>` +
    (d.top20 || [])
      .map(
        (r, i) => `
    <article class="card">
      <div class="card-head">
        <div>
          <div class="ticker">#${i + 1} ${r.ticker}</div>
          <div class="name">${r.name || ""}</div>
        </div>
        <span class="peg-badge">${r.peg}</span>
      </div>
      <div class="card-grid">
        <div><span>מחיר</span><strong>$${r.price}</strong></div>
        <div><span>יעד</span><strong>$${r.p_target}</strong></div>
        <div><span>G%</span><strong>${r.g_pct}%</strong></div>
        <div><span>D/E</span><strong>${r.de}</strong></div>
      </div>
    </article>`
      )
      .join("");
}

function renderUpdates(d) {
  const el = document.getElementById("updates");
  const acts = (d.all_trades?.length ? d.all_trades : d.latest_activity || []).slice().reverse();
  const hist = (d.history || []).slice().reverse();
  el.innerHTML =
    `<div class="section-title">קניות ומכירות</div>` +
    (acts.length
      ? acts
          .slice(0, 40)
          .map(
            (a) => `
      <div class="activity-item ${a.type}">
        <strong>${a.date}</strong> · ${a.type.toUpperCase()} ${a.ticker}<br />
        ${a.note || ""} ${a.amount ? fmt(a.amount) : ""}
        ${a.tax ? ` · מס ${fmt(a.tax)}` : ""}
      </div>`
          )
          .join("")
      : '<p class="loading">אין פעילות עדיין</p>') +
    `<div class="section-title">היסטוריית ערך</div>` +
    hist
      .slice(0, 12)
      .map(
        (h) => `
      <div class="activity-item">
        <strong>${h.date}</strong> · ${fmt(h.value)} · ${fmtPct(h.return_pct)}
      </div>`
      )
      .join("");
}

function setupRangeBar() {
  const bar = document.getElementById("rangeBar");
  if (!chartData?.ranges) {
    bar.innerHTML = "";
    return;
  }
  const keys = RANGE_ORDER.filter((k) => chartData.ranges[k]);
  if (!keys.includes(activeRange)) activeRange = keys[0] || "1d";
  bar.innerHTML = keys
    .map(
      (k) =>
        `<button class="range-btn${k === activeRange ? " active" : ""}" data-range="${k}">${
          chartData.ranges[k].label
        }</button>`
    )
    .join("");
  bar.querySelectorAll(".range-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeRange = btn.dataset.range;
      setupRangeBar();
      drawChart();
    });
  });
}

function drawLine(ctx, vals, w, h, pad, min, max, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  let started = false;
  vals.forEach((v, i) => {
    if (v == null) return;
    const x = pad + (i / (vals.length - 1 || 1)) * (w - 2 * pad);
    const y = h - pad - ((v - min) / (max - min || 1)) * (h - 2 * pad);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function drawChart() {
  const canvas = document.getElementById("equityChart");
  const stats = document.getElementById("chartStats");
  const ctx = canvas.getContext("2d");
  if (!chartData?.ranges?.[activeRange]) {
    stats.innerHTML = '<p class="loading">אין נתוני גרף</p>';
    return;
  }
  const r = chartData.ranges[activeRange];
  const port = r.portfolio || [];
  const spy = r.spy || [];
  const all = [...port.filter((v) => v != null), ...spy.filter((v) => v != null)];
  if (all.length < 2) {
    stats.innerHTML = '<p class="loading">לא מספיק נקודות</p>';
    return;
  }
  const w = canvas.parentElement.clientWidth - 32;
  const h = 160;
  canvas.width = w;
  canvas.height = h;
  const min = Math.min(...all) * 0.995;
  const max = Math.max(...all) * 1.005;
  const pad = 10;
  ctx.clearRect(0, 0, w, h);
  drawLine(ctx, spy, w, h, pad, min, max, "#64748b");
  drawLine(ctx, port, w, h, pad, min, max, "#7c3aed");
  const pc = r.port_return_pct ?? 0;
  const sc = r.spy_return_pct ?? 0;
  const diff = +(pc - sc).toFixed(2);
  stats.innerHTML = `
    <span>תיק: <strong class="${pc >= 0 ? "pos" : "neg"}">${fmtPct(pc)}</strong></span>
    <span>SPY: <strong class="${sc >= 0 ? "pos" : "neg"}">${fmtPct(sc)}</strong></span>
    <span>פער: <strong class="${diff >= 0 ? "pos" : "neg"}">${fmtPct(diff)}</strong></span>`;
}

function renderChart() {
  setupRangeBar();
  drawChart();
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
      if (btn.dataset.tab === "chart") renderChart();
    });
  });
}

async function init() {
  setupTabs();
  try {
    const [data, chart] = await Promise.all([apiGet("portfolio"), apiGet("chart").catch(() => null)]);
    chartData = chart;
    document.getElementById("loading").hidden = true;
    document.getElementById("main").hidden = false;
    renderHero(data);
    renderHoldings(data);
    renderTop20(data);
    renderUpdates(data);
    renderChart();
  } catch (e) {
    document.getElementById("loading").hidden = true;
    const err = document.getElementById("error");
    err.hidden = false;
    err.textContent = "אין חיבור לענן — בדוק אינטרנט ונסה שוב";
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

init();
