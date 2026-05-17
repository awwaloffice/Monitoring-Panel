export function statusBadge(status) {
  const map = { online: "badge-online", warning: "badge-warning", down: "badge-down", critical: "badge-critical", unknown: "badge-unknown" };
  return `badge ${map[status] || "badge-unknown"}`;
}

export function statusColor(status) {
  const map = { online: "var(--online)", warning: "var(--warning)", down: "var(--down)", critical: "var(--down)", unknown: "var(--unknown)" };
  return map[status] || "var(--unknown)";
}

export function healthColor(score) {
  if (score >= 90) return "var(--online)";
  if (score >= 70) return "var(--warning)";
  return "var(--down)";
}

export function formatLatency(val) {
  if (val == null) return "—";
  return `${Number(val).toFixed(1)}ms`;
}

export function formatLoss(val) {
  if (val == null) return "—";
  return `${Number(val).toFixed(1)}%`;
}

export function formatUptime(seconds) {
  if (!seconds) return "0s";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  return parts.join(" ") || "0m";
}

export function formatDate(str) {
  if (!str) return "—";

  // Backend stores SQLite timestamp as UTC without timezone, like:
  // 2026-05-15 05:21:30
  // Browser otherwise treats it as local time. So we force UTC by adding Z.
  const normalized =
    typeof str === "string" && !str.endsWith("Z") && !str.includes("+")
      ? str.replace(" ", "T") + "Z"
      : str;

  const d = new Date(normalized);
  if (isNaN(d)) return str;

  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDateShort(str) {
  if (!str) return "—";

  const normalized =
    typeof str === "string" && !str.endsWith("Z") && !str.includes("+")
      ? str.replace(" ", "T") + "Z"
      : str;

  const d = new Date(normalized);
  if (isNaN(d)) return str;

  return d.toLocaleString("en-GB", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function priorityLabel(p) {
  return { critical: "Critical", high: "High", medium: "Medium", low: "Low" }[p] || p;
}

export function priorityClass(p) {
  return `priority-${p}`;
}

export function groupColor(grp) {
  const map = {
    GGC: "#3b82f6", FNA: "#8b5cf6", Games: "#f59e0b",
    CDN: "#06b6d4", DNS: "#10b981", IX: "#ef4444", Other: "#6b7280",
  };
  return map[grp] || "#6b7280";
}

export function deviceTypeIcon(type) {
  const map = {
    ONU: "📡", Switch: "🔀", OLT: "🖥️", AP: "📶",
    CCTV: "📷", Server: "🖧", NAS: "💾", Gateway: "🌐",
    Printer: "🖨️", Other: "📦",
  };
  return map[type] || "📦";
}

export function csvDownload(rows, filename) {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
