import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFetch, useDebounce } from "../../hooks";
import { devicesApi } from "../../services/api";
import { StatusBadge, Loading, Empty } from "../../components/ui";
import { formatLatency, formatLoss, deviceTypeIcon } from "../../utils";

const TYPES = [
  "All",
  "ONU",
  "Switch",
  "OLT",
  "AP",
  "CCTV",
  "Server",
  "NAS",
  "Gateway",
  "Printer",
  "Other",
];

const STATUS_ORDER = {
  down: 1,
  warning: 2,
  unknown: 3,
  online: 4,
};

const FILTER_ICON = (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 5h18" />
    <path d="M6 12h12" />
    <path d="M10 19h4" />
  </svg>
);

function formatTimeAgo(value) {
  if (!value) return "—";

  const normalized =
    typeof value === "string" && !value.endsWith("Z") && !value.includes("+")
      ? value.replace(" ", "T") + "Z"
      : value;

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "—";

  const diffSeconds = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 1000)
  );

  if (diffSeconds < 10) return "just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;

  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears}y ago`;
}

function getUptimeColor(score) {
  if (score == null) return "var(--text-3)";
  if (score >= 95) return "var(--online)";
  if (score >= 80) return "var(--warning)";
  return "var(--down)";
}

function SearchSelect({
  value,
  onTextChange,
  onSelect,
  options,
  placeholder,
  width = 230,
  icon = FILTER_ICON,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const filteredOptions = useMemo(() => {
    const q = String(value || "").trim().toLowerCase();
    if (!q) return options;

    return options.filter((opt) =>
      String(opt.label || "").toLowerCase().includes(q)
    );
  }, [value, options]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      ref={wrapRef}
      style={{
        position: "relative",
        width,
        minWidth: 210,
        flex: "0 0 auto",
        zIndex: open ? 9999 : 10,
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
        }}
      >
        <span
          style={{
            position: "absolute",
            left: 12,
            width: 18,
            height: 18,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#64748b",
            zIndex: 2,
          }}
        >
          {icon}
        </span>

        <input
          value={value}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onTextChange(e.target.value);
            setOpen(true);
          }}
          style={{
            width: "100%",
            height: 40,
            border: "1px solid #e2e8f0",
            outline: "none",
            fontSize: "0.82rem",
            padding: "0 34px 0 38px",
            background: "#ffffff",
            borderRadius: 12,
            boxShadow: "0 4px 12px rgba(15, 23, 42, 0.04)",
            fontWeight: 700,
            color: "#0f172a",
          }}
        />

        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          style={{
            position: "absolute",
            right: 8,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: "#94a3b8",
            fontSize: 12,
            height: 26,
            width: 26,
          }}
        >
          ▾
        </button>
      </div>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 99999,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            boxShadow: "0 16px 35px rgba(15, 23, 42, 0.14)",
            overflow: "hidden",
            maxHeight: 260,
          }}
        >
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              setOpen(false);
            }}
            style={{
              width: "100%",
              padding: "10px 13px",
              textAlign: "left",
              border: "none",
              background: "#fff",
              cursor: "pointer",
              fontSize: "0.82rem",
              fontWeight: 800,
              color: "#0f172a",
              borderBottom: "1px solid #f1f5f9",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f8fafc";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#fff";
            }}
          >
            All
          </button>

          <div style={{ maxHeight: 210, overflowY: "auto" }}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onSelect(opt);
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 13px",
                    textAlign: "left",
                    border: "none",
                    background: "#fff",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f8fafc";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#fff";
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.82rem",
                      fontWeight: 750,
                      color: "#0f172a",
                    }}
                  >
                    {opt.label}
                  </span>

                  {opt.subLabel && (
                    <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                      {opt.subLabel}
                    </span>
                  )}
                </button>
              ))
            ) : (
              <div
                style={{
                  padding: "14px",
                  fontSize: "0.8rem",
                  color: "#94a3b8",
                }}
              >
                No match found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LocalDeviceMonitorPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [type, setType] = useState("All");

  const [routerName, setRouterName] = useState("");
  const [selectedRouter, setSelectedRouter] = useState("All");

  const [groupName, setGroupName] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("All");

  const dSearch = useDebounce(search);

  const { data, loading } = useFetch(
    () =>
      devicesApi.list({
        search: dSearch || undefined,
        type: type !== "All" ? type : undefined,
      }),
    [dSearch, type],
    30
  );

  const rawDevices = Array.isArray(data) ? data : data?.data || [];

  const routerOptions = [
    ...new Set(
      rawDevices
        .map((d) => d.router_name)
        .filter((v) => v && String(v).trim() !== "")
    ),
  ].map((name) => ({
    value: name,
    label: name,
    subLabel: `${
      rawDevices.filter((d) => d.router_name === name).length
    } devices`,
  }));

  const groupOptions = [
    ...new Set(
      rawDevices
        .map((d) => d.location)
        .filter((v) => v && String(v).trim() !== "")
    ),
  ].map((location) => ({
    value: location,
    label: location,
    subLabel: `${
      rawDevices.filter((d) => d.location === location).length
    } devices`,
  }));

  const filteredDevices = rawDevices.filter((d) => {
    const routerOk =
      selectedRouter === "All" || String(d.router_name || "") === selectedRouter;

    const groupOk =
      selectedGroup === "All" || String(d.location || "") === selectedGroup;

    return routerOk && groupOk;
  });

  const devices = [...filteredDevices].sort((a, b) => {
    const aOrder = STATUS_ORDER[a.status] || 99;
    const bOrder = STATUS_ORDER[b.status] || 99;

    if (aOrder !== bOrder) return aOrder - bOrder;

    const aLoss = Number(a.packet_loss || 0);
    const bLoss = Number(b.packet_loss || 0);

    if (aLoss !== bLoss) return bLoss - aLoss;

    const aLatency = Number(a.avg_latency || 0);
    const bLatency = Number(b.avg_latency || 0);

    return bLatency - aLatency;
  });

  const counts = {
    online: devices.filter((d) => d.status === "online").length,
    warning: devices.filter((d) => d.status === "warning").length,
    down: devices.filter((d) => d.status === "down").length,
    flapping: devices.filter((d) => d.flapping).length,
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedRouter("All");
    setRouterName("");
    setSelectedGroup("All");
    setGroupName("");
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Local Device Monitor</div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 16,
            fontSize: "0.8rem",
            flexWrap: "wrap",
          }}
        >
          <span style={{ color: "var(--online)", fontWeight: 600 }}>
            ↑ {counts.online} Online
          </span>
          <span style={{ color: "var(--warning)", fontWeight: 600 }}>
            ⚠ {counts.warning} Warning
          </span>
          <span style={{ color: "var(--down)", fontWeight: 600 }}>
            ↓ {counts.down} Down
          </span>

          {counts.flapping > 0 && (
            <span style={{ color: "#8b5cf6", fontWeight: 600 }}>
              ⚡ {counts.flapping} Flapping
            </span>
          )}
        </div>
      </div>

      <div className="page-content">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              style={{
                padding: "5px 12px",
                borderRadius: 999,
                fontSize: "0.78rem",
                fontWeight: 500,
                cursor: "pointer",
                border: "1px solid",
                borderColor: type === t ? "var(--primary)" : "var(--border)",
                background: type === t ? "var(--primary)" : "var(--surface)",
                color: type === t ? "#fff" : "var(--text-2)",
                transition: "all 0.15s",
              }}
            >
              {t !== "All" && deviceTypeIcon(t)} {t}
            </button>
          ))}
        </div>

        <div
          className="filter-bar"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "nowrap",
            overflow: "visible",
            position: "relative",
            zIndex: 50,
            width: "100%",
            padding: "10px",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            boxShadow: "0 10px 28px rgba(15, 23, 42, 0.05)",
          }}
        >
          <div
            style={{
              width: 300,
              height: 40,
              flex: "0 0 auto",
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "0 12px",
              borderRadius: 12,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
            }}
          >
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: 8,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#2563eb",
                color: "#ffffff",
                flex: "0 0 auto",
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, IP, router..."
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                outline: "none",
                background: "transparent",
                color: "#0f172a",
                fontSize: "0.83rem",
                fontWeight: 650,
              }}
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                title="Clear search"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#475569",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 900,
                  flex: "0 0 auto",
                }}
              >
                ×
              </button>
            )}
          </div>

          <span
            style={{
              height: 40,
              fontSize: "0.78rem",
              whiteSpace: "nowrap",
              flex: "0 0 auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              background: "#ecfdf5",
              color: "#047857",
              border: "1px solid #a7f3d0",
              padding: "0 13px",
              borderRadius: 12,
              fontWeight: 800,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#10b981",
              }}
            />
            {devices.length} devices
          </span>

          <SearchSelect
            value={routerName}
            options={routerOptions}
            placeholder="Router"
            icon={FILTER_ICON}
            width={230}
            onTextChange={(value) => {
              setRouterName(value);
              if (!value.trim()) setSelectedRouter("All");
            }}
            onSelect={(opt) => {
              if (!opt) {
                setSelectedRouter("All");
                setRouterName("");
                return;
              }

              setSelectedRouter(opt.value);
              setRouterName(opt.label);
            }}
          />

          <SearchSelect
            value={groupName}
            options={groupOptions}
            placeholder="Group"
            icon={FILTER_ICON}
            width={230}
            onTextChange={(value) => {
              setGroupName(value);
              if (!value.trim()) setSelectedGroup("All");
            }}
            onSelect={(opt) => {
              if (!opt) {
                setSelectedGroup("All");
                setGroupName("");
                return;
              }

              setSelectedGroup(opt.value);
              setGroupName(opt.label);
            }}
          />

          <button
            type="button"
            onClick={clearFilters}
            style={{
              height: 40,
              padding: "0 14px",
              whiteSpace: "nowrap",
              flex: "0 0 auto",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontSize: "0.8rem",
              fontWeight: 800,
              borderRadius: 12,
              border: "1px solid #fecaca",
              background: "#fff1f2",
              color: "#dc2626",
              cursor: "pointer",
            }}
          >
            ✕ Clear
          </button>
        </div>

        <div className="card" style={{ position: "relative", zIndex: 1 }}>
          {loading ? (
            <Loading />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>IP Address</th>
                    <th>Type</th>
                    <th>Router</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Latency</th>
                    <th>Loss</th>
                    <th>Uptime</th>
                    <th>Last Seen</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {devices.map((d) => (
                    <tr
                      key={d.id}
                      style={{ cursor: "pointer" }}
                      onClick={() =>
                        navigate(`/monitoring/local-devices/${d.id}`)
                      }
                    >
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span>{deviceTypeIcon(d.device_type)}</span>
                          <span style={{ fontWeight: 600 }}>{d.name}</span>

                          {d.flapping && (
                            <span
                              style={{
                                fontSize: "0.68rem",
                                background: "#ede9fe",
                                color: "#7c3aed",
                                padding: "1px 6px",
                                borderRadius: 999,
                                fontWeight: 600,
                              }}
                            >
                              FLAPPING
                            </span>
                          )}
                        </div>
                      </td>

                      <td
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "0.8rem",
                          color: "var(--text-2)",
                        }}
                      >
                        {d.ip}
                      </td>

                      <td style={{ fontSize: "0.8rem" }}>{d.device_type}</td>

                      <td
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--text-2)",
                        }}
                      >
                        {d.router_name || "—"}
                      </td>

                      <td
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--text-3)",
                        }}
                      >
                        {d.location || "—"}
                      </td>

                      <td>
                        <StatusBadge status={d.status} />
                      </td>

                      <td
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "0.82rem",
                        }}
                      >
                        {formatLatency(d.avg_latency)}
                      </td>

                      <td
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "0.82rem",
                          color:
                            d.packet_loss > 10 ? "var(--warning)" : "inherit",
                        }}
                      >
                        {formatLoss(d.packet_loss)}
                      </td>

                      <td
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "0.82rem",
                          fontWeight: 800,
                          color: getUptimeColor(d.uptime_pct),
                        }}
                      >
                        {d.uptime_pct != null ? `${d.uptime_pct}%` : "—"}
                      </td>

                      <td
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-3)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatTimeAgo(d.last_checked)}
                      </td>

                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/monitoring/local-devices/${d.id}`);
                          }}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {devices.length === 0 && <Empty text="No devices found" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}