import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFetch } from "../../hooks";
import { devicesApi } from "../../services/api";
import { StatusBadge, Loading } from "../../components/ui";
import { LatencyChart, PacketLossChart, UptimeBar, StatusTimeline } from "../../components/charts";
import { formatLatency, formatLoss, formatDate, formatUptime, deviceTypeIcon, priorityLabel } from "../../utils";

const RANGES = ["5m", "1h", "24h", "7d", "30d"];

export default function LocalDeviceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [range, setRange] = useState("1h");

  const { data: dev, loading } = useFetch(() => devicesApi.get(id), [id], 30);
  const { data: hist } = useFetch(() => devicesApi.history(id, { range }), [id, range], 30);

  if (loading) return <Loading />;
  if (!dev) return <div className="page-content"><p>Device not found.</p></div>;

  const totalSecs = (dev.total_up || 0) + (dev.total_down_time || 0);
  const uptimePct = totalSecs > 0 ? +((dev.total_up / totalSecs) * 100).toFixed(2) : 100;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>← Back</button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "1.4rem" }}>{deviceTypeIcon(dev.device_type)}</span>
              <span className="page-title">{dev.name}</span>
            </div>
            <div className="page-subtitle" style={{ fontFamily: "var(--font-mono)" }}>{dev.ip}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-2)" }}>{dev.device_type}</span>
          <StatusBadge status={dev.status || "unknown"} />
        </div>
      </div>

      <div className="page-content">
        {/* Info row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 16 }}>
          {[
            { label: "Router", value: dev.router_name || "—" },
            { label: "Location", value: dev.location || "—" },
            { label: "Priority", value: priorityLabel(dev.priority) },
            { label: "Uptime %", value: `${uptimePct}%` },
            { label: "Total Uptime", value: formatUptime(dev.total_up) },
            { label: "Total Downtime", value: formatUptime(dev.total_down_time) },
            { label: "Down Events", value: dev.down_events || 0 },
            { label: "Avg Latency", value: formatLatency(dev.avg_l) },
            { label: "Min Latency", value: formatLatency(dev.min_l) },
            { label: "Max Latency", value: formatLatency(dev.max_l) },
            { label: "Packet Loss", value: formatLoss(dev.avg_loss) },
            { label: "Last Down", value: formatDate(dev.last_down_time) },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <div className="stat-label">{s.label}</div>
              <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)", marginTop: 2 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Latency History</span>
            <div style={{ display: "flex", gap: 4 }}>
              {RANGES.map((r) => (
                <button key={r} className={`btn btn-sm ${range === r ? "btn-primary" : "btn-secondary"}`} onClick={() => setRange(r)}>{r}</button>
              ))}
            </div>
          </div>
          <div className="card-body"><LatencyChart data={hist?.history || []} height={200} /></div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Packet Loss</span></div>
          <div className="card-body"><PacketLossChart data={hist?.history || []} height={150} /></div>
        </div>

        {hist?.history?.length > 0 && (
          <div className="card">
            <div className="card-header"><span className="card-title">Status Timeline</span></div>
            <div className="card-body"><StatusTimeline data={hist.history} height={40} /></div>
          </div>
        )}

        {hist?.daily?.length > 0 && (
          <div className="card">
            <div className="card-header"><span className="card-title">Daily Availability (last 30 days)</span></div>
            <div className="card-body"><UptimeBar daily={hist.daily} height={100} /></div>
          </div>
        )}
      </div>
    </div>
  );
}
