const CSV_PATH = "data.csv";

const MONTHS = [
  "Ian", "Feb", "Mar", "Apr", "Mai", "Iun",
  "Iul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function parseCSV(text) {
  // parser simplu: suportă câmpuri cu ghilimele duble și virgule
  const rows = [];
  let i = 0, field = "", row = [], inQuotes = false;

  const pushField = () => { row.push(field); field = ""; };
  const pushRow = () => { rows.push(row); row = []; };

  while (i < text.length) {
    const c = text[i];

    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      inQuotes = !inQuotes; i++; continue;
    }

    if (!inQuotes && c === ",") { pushField(); i++; continue; }
    if (!inQuotes && (c === "\n" || c === "\r")) {
      // finalizează rândul (gestionează CRLF)
      if (c === "\r" && text[i + 1] === "\n") i++;
      pushField();
      // evită rânduri goale de la final
      if (row.some(v => v.trim() !== "")) pushRow();
      i++;
      continue;
    }

    field += c;
    i++;
  }

  // ultimul rând
  pushField();
  if (row.some(v => v.trim() !== "")) pushRow();

  const header = rows.shift().map(h => h.trim());
  return rows.map(r => {
    const obj = {};
    header.forEach((h, idx) => obj[h] = (r[idx] ?? "").trim());
    return obj;
  });
}

function ymKey(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthLabel(year, month) {
  return `${MONTHS[month - 1]} ${year}`;
}

function buildMonthAxis(startYear, endYear) {
  const list = [];
  for (let y = startYear; y <= endYear; y++) {
    for (let m = 1; m <= 12; m++) {
      list.push({ year: y, month: m, key: ymKey(y, m), label: monthLabel(y, m) });
    }
  }
  return list;
}

function clampPct(x) {
  const n = Number(x);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function showTooltip(el, tooltip, data) {
  const rect = el.getBoundingClientRect();
  const pad = 12;
  const x = rect.left + rect.width / 2;
  const y = rect.top;

  tooltip.innerHTML = `
    <div class="t-title">${escapeHtml(data.task)}</div>
    <div class="t-row"><b>Lună:</b> ${escapeHtml(data.monthLabel)}</div>
    <div class="t-row"><b>Progres:</b> ${data.progress}%</div>
    <div class="t-row"><b>Status:</b> ${escapeHtml(data.status || "—")}</div>
    <div class="t-row"><b>Comentariu:</b> ${escapeHtml(data.comment || "—")}</div>
  `;

  tooltip.style.left = `${Math.max(pad, x - 220)}px`;
  tooltip.style.top = `${Math.max(pad, y - 10)}px`;
  tooltip.style.opacity = "1";
  tooltip.style.transform = "translateY(0)";
}

function hideTooltip(tooltip) {
  tooltip.style.opacity = "0";
  tooltip.style.transform = "translateY(8px)";
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function statusBadge(status) {
  const val = status || "—";
  return `<span class="badge">${escapeHtml(val)}</span>`;
}

async function main() {
  const gridEl = document.getElementById("grid");
  const tooltip = document.getElementById("tooltip");
  const summaryBody = document.getElementById("summaryBody");

  const resp = await fetch(CSV_PATH, { cache: "no-store" });
  const csvText = await resp.text();
  const rows = parseCSV(csvText);

  // CSV columns așteptate:
  // task,year,month,progress,status,comment
  const tasks = [...new Set(rows.map(r => r.task).filter(Boolean))].sort((a,b)=>a.localeCompare(b, "ro"));
  const months = buildMonthAxis(2026, 2027);

  // map rapid: task -> monthKey -> record
  const map = new Map();
  for (const r of rows) {
    const t = r.task;
    const y = Number(r.year);
    const m = Number(r.month);
    if (!t || !y || !m) continue;
    const key = `${t}__${ymKey(y, m)}`;
    map.set(key, {
      task: t,
      year: y,
      month: m,
      progress: clampPct(r.progress),
      status: r.status || "",
      comment: r.comment || ""
    });
  }

  // grid config
  const COLS = 1 + months.length; // prima coloană = task
  const ROWS = 1 + tasks.length;  // primul rând = header luni
  gridEl.style.gridTemplateColumns = `260px repeat(${months.length}, 110px)`;
  gridEl.style.gridAutoRows = `42px`;

  // (0,0) corner
  const corner = document.createElement("div");
  corner.className = "cell header rowhead";
  corner.textContent = "Task \\ Lună";
  gridEl.appendChild(corner);

  // header luni
  for (const mo of months) {
    const cell = document.createElement("div");
    cell.className = "cell header";
    cell.textContent = mo.label;
    gridEl.appendChild(cell);
  }

  // rânduri tasks
  for (const task of tasks) {
    const head = document.createElement("div");
    head.className = "cell rowhead";
    head.textContent = task;
    gridEl.appendChild(head);

    for (const mo of months) {
      const rec = map.get(`${task}__${mo.key}`) || {
        task,
        year: mo.year,
        month: mo.month,
        progress: 0,
        status: "",
        comment: ""
      };

      const cell = document.createElement("div");
      cell.className = "cell";

      const p = document.createElement("div");
      p.className = "progress";

      const bar = document.createElement("div");
      bar.className = "bar";
      bar.style.width = `${rec.progress}%`;

      const pct = document.createElement("div");
      pct.className = "pct";
      pct.textContent = `${rec.progress}%`;

      p.appendChild(bar);
      p.appendChild(pct);
      cell.appendChild(p);

      // tooltip hover
      const tooltipData = {
        task: rec.task,
        monthLabel: mo.label,
        progress: rec.progress,
        status: rec.status,
        comment: rec.comment
      };

      cell.addEventListener("mouseenter", () => showTooltip(cell, tooltip, tooltipData));
      cell.addEventListener("mousemove", () => showTooltip(cell, tooltip, tooltipData));
      cell.addEventListener("mouseleave", () => hideTooltip(tooltip));

      gridEl.appendChild(cell);
    }
  }

  // rezumat: ultimul status + ultimul comentariu disponibil și progresul cel mai recent
  // regulă: căutăm ultimul rând (după an/lună) cu status/comentariu ne-gol, și ultimul progres în general
  const latestByTask = new Map();

  const sortedRows = [...rows].sort((a, b) => {
    const ay = Number(a.year) || 0, by = Number(b.year) || 0;
    const am = Number(a.month) || 0, bm = Number(b.month) || 0;
    if (ay !== by) return ay - by;
    return am - bm;
  });

  for (const task of tasks) {
    let lastProgress = 0;
    let lastStatus = "";
    let lastComment = "";

    for (const r of sortedRows) {
      if (r.task !== task) continue;
      lastProgress = clampPct(r.progress);

      if ((r.status || "").trim() !== "") lastStatus = r.status.trim();
      if ((r.comment || "").trim() !== "") lastComment = r.comment.trim();
    }

    latestByTask.set(task, { lastProgress, lastStatus, lastComment });
  }

  summaryBody.innerHTML = tasks.map(t => {
    const v = latestByTask.get(t);
    return `
      <tr>
        <td>${escapeHtml(t)}</td>
        <td>${statusBadge(v.lastStatus)}</td>
        <td>${escapeHtml(v.lastComment || "—")}</td>
        <td>${escapeHtml(String(v.lastProgress))}%</td>
      </tr>
    `;
  }).join("");
}

main().catch(err => {
  console.error(err);
  alert("Eroare la încărcarea datelor. Verifică dacă rulezi pagina printr-un server local (nu direct file://) și dacă data.csv există.");
});



