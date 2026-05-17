import { useParams, useNavigate } from "react-router-dom";
import { useFetch } from "../../hooks";
import { routersApi } from "../../services/api";
import { StatusBadge, Loading } from "../../components/ui";
import { formatLatency, formatLoss, formatDate } from "../../utils";

export default function RouterDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: router, loading } = useFetch(() => routersApi.get(id), [id]);
  const { data: services } = useFetch(() => routersApi.services(id), [id]);
  const { data: report } = useFetch(() => routersApi.report(id), [id]);

  if (loading) return <Loading />;
  if (!router) return <div className="page-content"><p>Router not found.</p></div>;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>← Back</button>
          <div>
            <div className="page-title">{router.name}</div>
            <div className="page-subtitle" style={{ fontFamily: "var(--font-mono)" }}>{router.host}:{router.api_port}</div>
          </div>
        </div>
        <StatusBadge status={router.connection_status === "connected" ? "online" : "down"} />
      </div>

      <div className="page-content">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Info */}
          <div className="card">
            <div className="card-header"><span className="card-title">Router Information</span></div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                ["Name", router.name],
                ["Host", router.host],
                ["API Port", router.api_port],
                ["SSL", router.api_ssl ? "Yes" : "No"],
                ["Location", router.location || "—"],
                ["ROS Version", router.ros_version || "—"],
                ["Uptime", router.uptime || "—"],
                ["Last Seen", formatDate(router.last_seen)],
                ["Description", router.description || "—"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: 12, fontSize: "0.82rem" }}>
                  <span style={{ color: "var(--text-3)", minWidth: 110 }}>{k}</span>
                  <span style={{ fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Services */}
          <div className="card">
            <div className="card-header"><span className="card-title">Router Services</span></div>
            <div className="card-body" style={{ fontSize: "0.82rem" }}>
              {services?.success ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(services.services || []).map((s, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--border-light)" }}>
                      <span>{s.name}</span>
                      <span style={{ color: s.disabled === "true" ? "var(--down)" : "var(--online)", fontWeight: 600 }}>
                        {s.disabled === "true" ? "Disabled" : `Port ${s.port}`}
                      </span>
                    </div>
                  ))}
                  {(services.routes || []).slice(0, 3).map((r, i) => (
                    <div key={i} style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>
                      Default GW: <strong>{r.gateway}</strong> via {r["gateway-interface"] || r.interface || "—"}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--text-3)" }}>{services?.error || "Connect to router to view services"}</p>
              )}
            </div>
          </div>
        </div>

        {/* Destination results from this router */}
        <div className="card">
          <div className="card-header"><span className="card-title">Recent Destination Results (This Router)</span></div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Destination</th><th>Group</th><th>Status</th><th>Avg Latency</th><th>Packet Loss</th><th>Checked</th></tr>
              </thead>
              <tbody>
                {(report?.results || []).slice(0, 20).map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.dest_name}</td>
                    <td style={{ fontSize: "0.78rem" }}>{r.grp}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>{formatLatency(r.avg_latency)}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>{formatLoss(r.packet_loss)}</td>
                    <td style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>{formatDate(r.checked_at)}</td>
                  </tr>
                ))}
                {(!report?.results || report.results.length === 0) && (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--text-3)" }}>No results yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
