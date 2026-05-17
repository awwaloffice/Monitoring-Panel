import { useState, useEffect } from "react";
import { useFetch } from "../../hooks";
import { settingsApi } from "../../services/api";
import { Loading } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

const SETTING_GROUPS = [
  {
    title: "Monitoring Settings",
    fields: [
      { key: "check_interval", label: "Global Check Interval (seconds)", type: "number", min: 10, max: 3600 },
      { key: "ping_packet_count", label: "Ping Packet Count", type: "number", min: 1, max: 20 },
      { key: "ping_timeout", label: "Ping Timeout (ms)", type: "number", min: 500, max: 10000 },
      { key: "retry_count", label: "Retry Count on Failure", type: "number", min: 0, max: 5 },
      { key: "auto_refresh_interval", label: "UI Auto Refresh Interval (seconds)", type: "number", min: 10, max: 300 },
    ],
  },
  {
    title: "Threshold Settings",
    fields: [
      { key: "warn_latency", label: "Default Warning Latency (ms)", type: "number" },
      { key: "crit_latency", label: "Default Critical Latency (ms)", type: "number" },
      { key: "warn_loss", label: "Default Warning Packet Loss (%)", type: "number" },
      { key: "crit_loss", label: "Default Critical Packet Loss (%)", type: "number" },
      { key: "flap_threshold", label: "Flapping Detection: Changes Count", type: "number", min: 2, max: 20 },
      { key: "flap_window", label: "Flapping Detection: Time Window (seconds)", type: "number", min: 60, max: 3600 },
    ],
  },
  {
    title: "System Settings",
    fields: [
      { key: "app_name", label: "Application Name", type: "text" },
      { key: "session_timeout", label: "Session Timeout (seconds)", type: "number", min: 300, max: 86400 },
    ],
  },
];

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const { data, loading } = useFetch(() => settingsApi.get(), []);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm({ ...data });
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      await settingsApi.update(form);
      toast.success("Settings saved successfully");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  if (loading) return <Loading />;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-subtitle">System configuration and monitoring parameters</div>
        </div>
        {isAdmin() && (
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </button>
        )}
      </div>

      <div className="page-content">
        {SETTING_GROUPS.map((group) => (
          <div key={group.title} className="card">
            <div className="card-header">
              <span className="card-title">{group.title}</span>
            </div>
            <div className="card-body">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                {group.fields.map((field) => (
                  <div key={field.key} className="form-group">
                    <label className="form-label">{field.label}</label>
                    <input
                      className="form-input"
                      type={field.type}
                      min={field.min}
                      max={field.max}
                      value={form[field.key] ?? ""}
                      onChange={(e) => f(field.key, e.target.value)}
                      disabled={!isAdmin()}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* Backup / Restore */}
        <div className="card">
          <div className="card-header"><span className="card-title">Backup & Restore</span></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: "0.82rem", color: "var(--text-2)" }}>
              Use these tools to backup or restore your monitoring configuration and data.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href="/api/settings/backup" className="btn btn-secondary" download>
                ⬇ Backup Configuration
              </a>
              {isAdmin() && (
                <label className="btn btn-secondary" style={{ cursor: "pointer" }}>
                  ⬆ Restore Configuration
                  <input type="file" style={{ display: "none" }} accept=".json" onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) toast("Restore functionality available via CLI. See docs.", { icon: "ℹ️" });
                  }} />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* API Info */}
        <div className="card">
          <div className="card-header"><span className="card-title">API Information</span></div>
          <div className="card-body">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {[
                ["API Base URL", window.location.origin + "/api"],
                ["Auth", "JWT Bearer Token"],
                ["Login Endpoint", "POST /api/auth/login"],
                ["Docs", "See README.md for full API reference"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{k}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text)" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* About */}
        <div className="card">
          <div className="card-header"><span className="card-title">About</span></div>
          <div className="card-body">
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.82rem", color: "var(--text-2)" }}>
              <div><strong>Monitoring Panel</strong> — Developed by Awwal Bin Zahid</div>
              <div>Version: 1.0.0</div>
              <div>Stack: React + Node.js + Express + SQLite</div>
              <div>MikroTik RouterOS API integration enabled</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
