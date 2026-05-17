import { statusBadge, statusColor, healthColor } from "../../utils";

// Status Badge
export function StatusBadge({ status }) {
  const label = status?.charAt(0).toUpperCase() + status?.slice(1) || "Unknown";
  return <span className={statusBadge(status)}>{label}</span>;
}

// Health Bar
export function HealthBar({ score }) {
  if (score == null) return <span style={{ color: "var(--text-3)", fontSize: "0.75rem" }}>—</span>;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 90 }}>
      <div className="health-bar" style={{ flex: 1 }}>
        <div className="health-bar-fill" style={{ width: `${score}%`, background: healthColor(score) }} />
      </div>
      <span style={{ fontSize: "0.75rem", color: healthColor(score), fontWeight: 600, minWidth: 30 }}>{score}%</span>
    </div>
  );
}

// Status Dot
export function StatusDot({ status, pulse = false }) {
  return (
    <span
      className={`dot dot-${status || "unknown"} ${pulse && status === "online" ? "pulse" : ""}`}
    />
  );
}

// Loading
export function Loading({ text = "Loading..." }) {
  return (
    <div className="loading-overlay">
      <div className="spinner" />
      <span>{text}</span>
    </div>
  );
}

// Empty state
export function Empty({ text = "No data found" }) {
  return (
    <div className="empty-state">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span>{text}</span>
    </div>
  );
}

// Modal
export function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="btn btn-icon btn-secondary btn-sm" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// Confirm dialog
export function Confirm({ open, onClose, onConfirm, title, message, confirmLabel = "Delete", danger = true }) {
  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm}>{confirmLabel}</button>
      </>}
    >
      <p style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>{message}</p>
    </Modal>
  );
}

// Mini spark line (SVG)
export function SparkLine({ data = [], color = "var(--primary)", height = 32, width = 80 }) {
  if (!data?.length) return <div style={{ width, height }} />;
  const vals = data.map((v) => (typeof v === "number" ? v : v?.y ?? 0));
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1 || 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Pagination
export function Pagination({ page, total, limit, onChange }) {
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", padding: "10px 0" }}>
      <span style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
        {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
      </span>
      <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => onChange(page - 1)}>‹</button>
      <button className="btn btn-secondary btn-sm" disabled={page === pages} onClick={() => onChange(page + 1)}>›</button>
    </div>
  );
}

// Toggle switch
export function Toggle({ checked, onChange, label }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
      <div style={{
        width: 36, height: 20, borderRadius: 10,
        background: checked ? "var(--primary)" : "var(--border)",
        position: "relative", transition: "background 0.2s",
      }}>
        <div style={{
          width: 14, height: 14, borderRadius: "50%", background: "#fff",
          position: "absolute", top: 3, left: checked ? 19 : 3,
          transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ display: "none" }} />
      </div>
      {label && <span style={{ fontSize: "0.82rem", color: "var(--text-2)" }}>{label}</span>}
    </label>
  );
}

// Stat card
export function StatCard({ label, value, sub, icon, color }) {
  return (
    <div className="stat-card">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <span className="stat-label">{label}</span>
        {icon && <span style={{ fontSize: "1.2rem", opacity: 0.6 }}>{icon}</span>}
      </div>
      <div className="stat-value" style={color ? { color } : {}}>{value ?? "—"}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

// Alert severity badge
export function SeverityBadge({ severity }) {
  const map = { critical: "badge-down", warning: "badge-warning", info: "badge-info" };
  return <span className={`badge ${map[severity] || "badge-unknown"}`}>{severity}</span>;
}
