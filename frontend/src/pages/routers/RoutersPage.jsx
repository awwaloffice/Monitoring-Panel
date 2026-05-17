// RoutersPage.jsx
import { useNavigate } from "react-router-dom";
import { useFetch } from "../../hooks";
import { routersApi } from "../../services/api";
import { StatusBadge, Loading, Empty } from "../../components/ui";
import { formatLatency, formatLoss, formatDate } from "../../utils";
import toast from "react-hot-toast";

export function RoutersPage() {
  const navigate = useNavigate();
  const { data, loading, refetch } = useFetch(() => routersApi.list(), [], 60);
  const routers = data || [];

  const testConnection = async (e, id) => {
    e.stopPropagation();
    toast.promise(routersApi.test(id), {
      loading: "Testing connection...",
      success: (res) => `${res.data.success ? "Connected" : "Failed"}: ${res.data.version || res.data.error}`,
      error: "Connection test failed",
    }).then(() => refetch());
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Source Routers</div>
          <div className="page-subtitle">routers used for monitoring</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate("/management/routers")}>+ Manage Routers</button>
      </div>
      <div className="page-content">
        <div className="card">
          {loading ? <Loading /> : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Router</th><th>Host</th><th>Location</th><th>API Status</th><th>ROS Version</th>
                    <th>Uptime</th><th>Dests</th><th>Devices</th><th>Avg Latency</th><th>Last Seen</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {routers.map((r) => (
                    <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/routers/${r.id}`)}>
                      <td style={{ fontWeight: 600 }}>{r.name}</td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-2)" }}>{r.host}:{r.api_port}</td>
                      <td style={{ fontSize: "0.8rem" }}>{r.location || "—"}</td>
                      <td><StatusBadge status={r.connection_status === "connected" ? "online" : r.connection_status === "disconnected" ? "down" : "unknown"} /></td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>{r.ros_version || "—"}</td>
                      <td style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>{r.uptime || "—"}</td>
                      <td style={{ textAlign: "center" }}>{r.dest_count || 0}</td>
                      <td style={{ textAlign: "center" }}>{r.device_count || 0}</td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>{formatLatency(r.avg_latency)}</td>
                      <td style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>{formatDate(r.last_seen)}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-secondary btn-sm" onClick={(e) => testConnection(e, r.id)}>Test</button>
                          <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/routers/${r.id}`); }}>View</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {routers.length === 0 && <Empty text="No routers configured" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RoutersPage;
