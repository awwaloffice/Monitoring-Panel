import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFetch } from "../../hooks";
import { destinationsApi } from "../../services/api";
import { StatusBadge, HealthBar, Loading } from "../../components/ui";
import { LatencyChart, PacketLossChart, StatusTimeline } from "../../components/charts";
import { formatLatency, formatLoss, formatDate, groupColor } from "../../utils";

const RANGES = ["5m", "1h", "24h", "7d", "30d"];

export default function DestinationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [range, setRange] = useState("1h");

  const { data: dest, loading } = useFetch(() => destinationsApi.get(id), [id], 30);
  const { data: history } = useFetch(() => destinationsApi.history(id, { range }), [id, range], 30);

  if (loading) return <Loading />;
  if (!dest) return <div className="page-content"><p>Destination not found.</p></div>;

  const avgLat = dest.router_results?.filter((r) => r.avg_latency).reduce((s, r, _, a) => s + r.avg_latency / a.length, 0);
  const avgLoss = dest.router_results?.filter((r) => r.packet_loss != null).reduce((s, r, _, a) => s + r.packet_loss / a.length, 0);

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>← Back</button>
          <div>
            <div className="page-title">{dest.name}</div>
            <div className="page-subtitle" style={{ fontFamily: "var(--font-mono)" }}>{dest.address}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ background: groupColor(dest.grp) + "22", color: groupColor(dest.grp), padding: "3px 10px", borderRadius: 999, fontSize: "0.78rem", fontWeight: 600 }}>
            {dest.grp}
          </span>
          <StatusBadge status={dest.router_results?.[0]?.status || "unknown"} />
        </div>
      </div>

      <div className="page-content">
        {/* Summary stats */}
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
          {[
            { label: "Avg Latency", value: formatLatency(avgLat) },
            { label: "Packet Loss", value: formatLoss(avgLoss) },
            { label: "Warning Threshold", value: `${dest.warn_latency}ms` },
            { label: "Critical Threshold", value: `${dest.crit_latency}ms` },
            { label: "Check Interval", value: `${dest.check_interval}s` },
            { label: "Packet Count", value: dest.packet_count },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ fontSize: "1.2rem" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Range selector + Charts */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Latency History</span>
            <div style={{ display: "flex", gap: 4 }}>
              {RANGES.map((r) => (
                <button key={r} className={`btn btn-sm ${range === r ? "btn-primary" : "btn-secondary"}`} onClick={() => setRange(r)}>{r}</button>
              ))}
            </div>
          </div>
          <div className="card-body">
            <LatencyChart data={history || []} height={220} />
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Packet Loss</span></div>
          <div className="card-body">
            <PacketLossChart data={history || []} height={160} />
          </div>
        </div>

        {/* Status timeline */}
        {history && history.length > 0 && (
          <div className="card">
            <div className="card-header"><span className="card-title">Status Timeline</span></div>
            <div className="card-body">
              <StatusTimeline data={history} height={40} />
              <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: "0.72rem", color: "var(--text-3)" }}>
                <span><span style={{ color: "var(--online)" }}>■</span> Online</span>
                <span><span style={{ color: "var(--warning)" }}>■</span> Warning</span>
                <span><span style={{ color: "var(--down)" }}>■</span> Down</span>
              </div>
            </div>
          </div>
        )}

        {/* Per-router results */}
        <div className="card">
          <div className="card-header"><span className="card-title">Per-Router Results</span></div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Router</th><th>Location</th><th>Status</th><th>Avg Latency</th><th>Min</th><th>Max</th><th>Packet Loss</th><th>Jitter</th><th>Last Checked</th></tr>
              </thead>
              <tbody>
                {(dest.router_results || []).map((r) => (
                  <tr key={r.router_id}>
                    <td style={{ fontWeight: 600 }}>{r.router_name}</td>
                    <td style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>{r.location || "—"}</td>
                    <td><StatusBadge status={r.status || "unknown"} /></td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>{formatLatency(r.avg_latency)}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-3)" }}>{formatLatency(r.min_latency)}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-3)" }}>{formatLatency(r.max_latency)}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>{formatLoss(r.packet_loss)}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>{formatLatency(r.jitter)}</td>
                    <td style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>{formatDate(r.checked_at)}</td>
                  </tr>
                ))}
                {(!dest.router_results || dest.router_results.length === 0) && (
                  <tr><td colSpan={9} style={{ textAlign: "center", padding: 24, color: "var(--text-3)" }}>No data yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
