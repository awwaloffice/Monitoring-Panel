import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

const BASE_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { mode: "index", intersect: false } },
  interaction: { mode: "nearest", axis: "x", intersect: false },
  elements: { point: { radius: 0, hoverRadius: 4 }, line: { tension: 0.3 } },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 10 }, color: "#94a3b8", maxTicksLimit: 8 } },
    y: { grid: { color: "#f1f5f9" }, ticks: { font: { size: 10 }, color: "#94a3b8" }, border: { display: false } },
  },
};

export function LatencyChart({ data = [], height = 200 }) {
  const labels = data.map((d) => {
    const t = new Date(d.ts || d.checked_at || "");
    return isNaN(t) ? "" : t.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  });
  const avgData = data.map((d) => d.avg_latency ?? null);
  const minData = data.map((d) => d.min_latency ?? null);
  const maxData = data.map((d) => d.max_latency ?? null);

  const chartData = {
    labels,
    datasets: [
      { label: "Max", data: maxData, borderColor: "#fca5a5", borderWidth: 1, borderDash: [3, 3], fill: false },
      { label: "Avg", data: avgData, borderColor: "#0f6fd8", backgroundColor: "rgba(15,111,216,0.08)", borderWidth: 2, fill: true },
      { label: "Min", data: minData, borderColor: "#86efac", borderWidth: 1, borderDash: [3, 3], fill: false },
    ],
  };

  return (
    <div style={{ height }}>
      <Line data={chartData} options={{ ...BASE_OPTIONS, plugins: { ...BASE_OPTIONS.plugins, legend: { display: true, position: "top", labels: { boxWidth: 10, font: { size: 10 }, color: "#64748b" } } } }} />
    </div>
  );
}

export function PacketLossChart({ data = [], height = 160 }) {
  const labels = data.map((d) => {
    const t = new Date(d.ts || d.checked_at || "");
    return isNaN(t) ? "" : t.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  });
  const lossData = data.map((d) => d.packet_loss ?? d.avg_loss ?? null);

  const chartData = {
    labels,
    datasets: [{
      label: "Packet Loss %",
      data: lossData,
      backgroundColor: lossData.map((v) => v >= 50 ? "#fecaca" : v >= 10 ? "#fef3c7" : "#dcfce7"),
      borderColor: lossData.map((v) => v >= 50 ? "#dc2626" : v >= 10 ? "#d97706" : "#16a34a"),
      borderWidth: 1,
      borderRadius: 3,
    }],
  };

  return (
    <div style={{ height }}>
      <Bar data={chartData} options={{ ...BASE_OPTIONS, scales: { ...BASE_OPTIONS.scales, y: { ...BASE_OPTIONS.scales.y, min: 0, max: 100 } } }} />
    </div>
  );
}

export function UptimeBar({ daily = [], height = 80 }) {
  const labels = daily.map((d) => d.date?.slice(5) || "");
  const avail = daily.map((d) => d.availability ?? 100);

  const chartData = {
    labels,
    datasets: [{
      label: "Availability %",
      data: avail,
      backgroundColor: avail.map((v) => v >= 99 ? "#dcfce7" : v >= 95 ? "#fef3c7" : "#fee2e2"),
      borderColor: avail.map((v) => v >= 99 ? "#16a34a" : v >= 95 ? "#d97706" : "#dc2626"),
      borderWidth: 1,
      borderRadius: 3,
    }],
  };

  return (
    <div style={{ height }}>
      <Bar data={chartData} options={{ ...BASE_OPTIONS, scales: { ...BASE_OPTIONS.scales, y: { ...BASE_OPTIONS.scales.y, min: 0, max: 100 } } }} />
    </div>
  );
}

export function StatusTimeline({ data = [], height = 40 }) {
  if (!data.length) return null;
  const segments = data.map((d) => ({
    status: d.status,
    color: d.status === "online" ? "#16a34a" : d.status === "warning" ? "#d97706" : "#dc2626",
  }));
  const w = 100 / segments.length;
  return (
    <div style={{ height, display: "flex", borderRadius: 4, overflow: "hidden", gap: 1 }}>
      {segments.map((s, i) => (
        <div key={i} style={{ flex: 1, background: s.color, minWidth: 2 }} title={s.status} />
      ))}
    </div>
  );
}
