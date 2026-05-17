import { useState } from "react";
import { useFetch } from "../../hooks";
import { reportsApi } from "../../services/api";
import { Loading, Empty, HealthBar } from "../../components/ui";
import { formatLatency, formatLoss, csvDownload } from "../../utils";

// ─── Destination Reports ───────────────────────────────────────────────────
export function DestinationReportsPage() {
  const [filters, setFilters] = useState({ from: "", to: "", group: "" });
  const { data, loading, refetch } = useFetch(() => reportsApi.destinations(filters), [JSON.stringify(filters)]);
  const f = (k, v) => setFilters((p) => ({ ...p, [k]: v }));

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Destination Reports</div><div className="page-subtitle">Historical performance of internet destinations</div></div>
        <button className="btn btn-secondary" onClick={() => csvDownload(data, "destination-report.csv")}>⬇ Export CSV</button>
      </div>
      <div className="page-content">
        <div className="filter-bar">
          <input type="date" className="form-input" style={{ width: 160 }} value={filters.from} onChange={(e) => f("from", e.target.value)} />
          <input type="date" className="form-input" style={{ width: 160 }} value={filters.to} onChange={(e) => f("to", e.target.value)} />
          <select className="form-input form-select" style={{ width: 140 }} value={filters.group} onChange={(e) => f("group", e.target.value)}>
            <option value="">All Groups</option>
            {["GGC","FNA","Games","CDN","DNS","IX","Other"].map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={refetch}>Apply</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setFilters({ from: "", to: "", group: "" })}>Clear</button>
        </div>
        <div className="card">
          {loading ? <Loading /> : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Destination</th><th>Address</th><th>Group</th><th>Avg Latency</th><th>Min</th><th>Max</th><th>Avg Loss</th><th>Avg Jitter</th><th>Availability</th><th>Checks</th></tr>
                </thead>
                <tbody>
                  {(data || []).map((d, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{d.name}</td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>{d.address}</td>
                      <td style={{ fontSize: "0.78rem" }}>{d.grp}</td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>{formatLatency(d.avg_latency)}</td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-3)" }}>{formatLatency(d.min_latency)}</td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-3)" }}>{formatLatency(d.max_latency)}</td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>{formatLoss(d.avg_loss)}</td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>{formatLatency(d.avg_jitter)}</td>
                      <td><HealthBar score={d.availability != null ? Math.round(d.availability) : null} /></td>
                      <td style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>{d.checks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!data || data.length === 0) && <Empty text="No report data for selected range" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Local Device Reports ──────────────────────────────────────────────────
export function LocalDeviceReportsPage() {
  const [filters, setFilters] = useState({ from: "", to: "", type: "" });
  const { data, loading, refetch } = useFetch(() => reportsApi.localDevices(filters), [JSON.stringify(filters)]);
  const f = (k, v) => setFilters((p) => ({ ...p, [k]: v }));

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Local Device Reports</div><div className="page-subtitle">LAN device performance history</div></div>
        <button className="btn btn-secondary" onClick={() => csvDownload(data, "devices-report.csv")}>⬇ Export CSV</button>
      </div>
      <div className="page-content">
        <div className="filter-bar">
          <input type="date" className="form-input" style={{ width: 160 }} value={filters.from} onChange={(e) => f("from", e.target.value)} />
          <input type="date" className="form-input" style={{ width: 160 }} value={filters.to} onChange={(e) => f("to", e.target.value)} />
          <select className="form-input form-select" style={{ width: 140 }} value={filters.type} onChange={(e) => f("type", e.target.value)}>
            <option value="">All Types</option>
            {["ONU","Switch","OLT","AP","CCTV","Server","NAS","Gateway","Printer","Other"].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={refetch}>Apply</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setFilters({ from: "", to: "", type: "" })}>Clear</button>
        </div>
        <div className="card">
          {loading ? <Loading /> : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Device</th><th>IP</th><th>Type</th><th>Location</th><th>Priority</th><th>Avg Latency</th><th>Avg Loss</th><th>Availability</th><th>Checks</th></tr>
                </thead>
                <tbody>
                  {(data || []).map((d, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{d.name}</td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>{d.ip}</td>
                      <td style={{ fontSize: "0.78rem" }}>{d.device_type}</td>
                      <td style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>{d.location || "—"}</td>
                      <td style={{ textTransform: "capitalize", fontSize: "0.78rem" }}>{d.priority}</td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>{formatLatency(d.avg_latency)}</td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>{formatLoss(d.avg_loss)}</td>
                      <td><HealthBar score={d.availability != null ? Math.round(d.availability) : null} /></td>
                      <td style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>{d.checks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!data || data.length === 0) && <Empty text="No report data" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Uptime Reports ────────────────────────────────────────────────────────
export function UptimeReportsPage() {
  const { data, loading } = useFetch(() => reportsApi.uptime(), []);

  const formatSeconds = (s) => {
    if (!s) return "0s";
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(" ") || "0m";
  };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Uptime Reports</div><div className="page-subtitle">Device availability and downtime statistics</div></div>
        <button className="btn btn-secondary" onClick={() => csvDownload(data, "uptime-report.csv")}>⬇ Export CSV</button>
      </div>
      <div className="page-content">
        <div className="card">
          {loading ? <Loading /> : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Device</th><th>IP</th><th>Type</th><th>Priority</th><th>Total Uptime</th><th>Total Downtime</th><th>Down Events</th><th>Avg Availability</th></tr>
                </thead>
                <tbody>
                  {(data || []).map((d, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{d.name}</td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>{d.ip}</td>
                      <td style={{ fontSize: "0.78rem" }}>{d.device_type}</td>
                      <td style={{ textTransform: "capitalize", fontSize: "0.78rem" }}>{d.priority}</td>
                      <td style={{ fontSize: "0.82rem", color: "var(--online)", fontWeight: 500 }}>{formatSeconds(d.total_up)}</td>
                      <td style={{ fontSize: "0.82rem", color: d.total_down > 0 ? "var(--down)" : "var(--text-3)", fontWeight: d.total_down > 0 ? 600 : 400 }}>{formatSeconds(d.total_down)}</td>
                      <td style={{ textAlign: "center" }}>{d.events || 0}</td>
                      <td><HealthBar score={d.avg_availability != null ? Math.round(d.avg_availability) : 100} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!data || data.length === 0) && <Empty text="No uptime data available" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Alert Reports ─────────────────────────────────────────────────────────
export function AlertReportsPage() {
  const [filters, setFilters] = useState({ from: "", to: "", status: "", severity: "" });
  const { data, loading, refetch } = useFetch(() => reportsApi.alerts(filters), [JSON.stringify(filters)]);
  const f = (k, v) => setFilters((p) => ({ ...p, [k]: v }));

  const severityStyle = { critical: "badge-down", warning: "badge-warning", info: "badge-info" };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Alert Reports</div><div className="page-subtitle">System alerts and incidents log</div></div>
        <button className="btn btn-secondary" onClick={() => csvDownload(data, "alert-report.csv")}>⬇ Export CSV</button>
      </div>
      <div className="page-content">
        <div className="filter-bar">
          <input type="date" className="form-input" style={{ width: 160 }} value={filters.from} onChange={(e) => f("from", e.target.value)} />
          <input type="date" className="form-input" style={{ width: 160 }} value={filters.to} onChange={(e) => f("to", e.target.value)} />
          <select className="form-input form-select" style={{ width: 130 }} value={filters.status} onChange={(e) => f("status", e.target.value)}>
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
          <select className="form-input form-select" style={{ width: 130 }} value={filters.severity} onChange={(e) => f("severity", e.target.value)}>
            <option value="">All Severity</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
          <button className="btn btn-primary btn-sm" onClick={refetch}>Apply</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setFilters({ from: "", to: "", status: "", severity: "" })}>Clear</button>
        </div>
        <div className="card">
          {loading ? <Loading /> : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Time</th><th>Severity</th><th>Type</th><th>Target</th><th>Message</th><th>Status</th><th>Recovery</th></tr>
                </thead>
                <tbody>
                  {(data || []).map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", whiteSpace: "nowrap" }}>{new Date(a.created_at).toLocaleString()}</td>
                      <td><span className={`badge ${severityStyle[a.severity] || "badge-unknown"}`}>{a.severity}</span></td>
                      <td style={{ fontSize: "0.78rem" }}>{a.type?.replace(/_/g, " ")}</td>
                      <td style={{ fontWeight: 600, fontSize: "0.82rem" }}>{a.target_name || "—"}</td>
                      <td style={{ fontSize: "0.78rem", color: "var(--text-2)", maxWidth: 280 }}>{a.message}</td>
                      <td>
                        <span className={`badge ${a.status === "open" ? "badge-down" : a.status === "resolved" ? "badge-online" : "badge-warning"}`}>
                          {a.status}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
                        {a.recovery_time ? new Date(a.recovery_time).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!data || data.length === 0) && <Empty text="No alerts for selected range" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Router Reports ────────────────────────────────────────────────────────
export function RouterReportsPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Router Reports</div>
          <div className="page-subtitle">Individual source router reports</div>
        </div>
      </div>

      <div className="page-content">
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <div style={{ color: "var(--text-3)", fontSize: "0.95rem" }}>
            Router report is not connected yet. Add a Report button from Source Routers page first.
          </div>
        </div>
      </div>
    </div>
  );
}

export default RouterReportsPage;
