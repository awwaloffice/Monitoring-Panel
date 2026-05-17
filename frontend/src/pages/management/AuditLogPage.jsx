import { useState } from "react";
import { useFetch } from "../../hooks";
import { auditApi } from "../../services/api";
import { Loading, Empty, Pagination, Modal } from "../../components/ui";
import { formatDate } from "../../utils";
import toast from "react-hot-toast";

const DEFAULT_SETTINGS = {
  audit_auto_clear_enabled: "false",
  audit_auto_clear_days: "30",
};

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    user: "",
    module: "",
    action: "",
    from: "",
    to: "",
  });

  const [settingsModal, setSettingsModal] = useState(false);
  const [settingsForm, setSettingsForm] = useState(DEFAULT_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);
  const [clearingAllLogs, setClearingAllLogs] = useState(false);

  const { data, loading, refetch } = useFetch(
    () => auditApi.list({ ...filters, page, limit: 50 }),
    [filters, page]
  );

  const { data: settingsData, refetch: refetchSettings } = useFetch(
    () => auditApi.settings(),
    []
  );

  const f = (k, v) => {
    setFilters((p) => ({ ...p, [k]: v }));
    setPage(1);
  };

  const openSettings = () => {
    const current = settingsData?.data || settingsData || {};

    setSettingsForm({
      audit_auto_clear_enabled:
        current.audit_auto_clear_enabled || DEFAULT_SETTINGS.audit_auto_clear_enabled,
      audit_auto_clear_days:
        current.audit_auto_clear_days || DEFAULT_SETTINGS.audit_auto_clear_days,
    });

    setSettingsModal(true);
  };

  const saveSettings = async () => {
    setSavingSettings(true);

    try {
      await auditApi.updateSettings(settingsForm);
      toast.success("Log settings saved");
      setSettingsModal(false);
      refetchSettings?.();
      refetch?.();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const clearOldLogs = async () => {
    const days = Number(settingsForm.audit_auto_clear_days || 30);

    if (!window.confirm(`Clear audit logs older than ${days} days?`)) return;

    setClearingLogs(true);

    try {
      const res = await auditApi.cleanup({ days });
      toast.success(`Deleted ${res.data.deleted || 0} old logs`);
      refetch?.();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to clear old logs");
    } finally {
      setClearingLogs(false);
    }
  };

  const clearAllLogsNow = async () => {
    const ok = window.confirm(
      "Are you sure you want to clear ALL audit logs now? This action cannot be undone."
    );

    if (!ok) return;

    setClearingAllLogs(true);

    try {
      const res = await auditApi.clearAll();
      toast.success(`Cleared ${res.data.deleted || 0} audit logs`);
      setPage(1);
      refetch?.();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to clear logs");
    } finally {
      setClearingAllLogs(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      user: "",
      module: "",
      action: "",
      from: "",
      to: "",
    });
    setPage(1);
  };

  const autoClearEnabled =
    String(
      settingsData?.data?.audit_auto_clear_enabled ||
        settingsData?.audit_auto_clear_enabled ||
        "false"
    ) === "true";

  const autoClearDays =
    settingsData?.data?.audit_auto_clear_days ||
    settingsData?.audit_auto_clear_days ||
    "30";

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Audit Log</div>
          <div className="page-subtitle">System activity log</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="btn btn-secondary" onClick={openSettings}>
            ⚙ Log Settings
          </button>

          <button className="btn btn-secondary" onClick={() => auditApi.export()}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      <div className="page-content">
        <div
          className="filter-bar"
          style={{
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
          }}
        >
          {[
            { key: "user", placeholder: "Filter by user" },
            { key: "module", placeholder: "Module" },
            { key: "action", placeholder: "Action" },
          ].map(({ key, placeholder }) => (
            <input
              key={key}
              className="form-input"
              style={{ width: 160 }}
              placeholder={placeholder}
              value={filters[key]}
              onChange={(e) => f(key, e.target.value)}
            />
          ))}

          <input
            type="date"
            className="form-input"
            style={{ width: 150 }}
            value={filters.from}
            onChange={(e) => f("from", e.target.value)}
          />

          <input
            type="date"
            className="form-input"
            style={{ width: 150 }}
            value={filters.to}
            onChange={(e) => f("to", e.target.value)}
          />

          <button className="btn btn-secondary btn-sm" onClick={clearFilters}>
            Clear
          </button>

          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "0.78rem",
              color: "var(--text-3)",
            }}
          >
            <span
              className={`badge ${
                autoClearEnabled ? "badge-online" : "badge-down"
              }`}
            >
              {autoClearEnabled ? "AUTO CLEAR ON" : "AUTO CLEAR OFF"}
            </span>
            <span>Keep: {autoClearDays} days</span>
          </div>
        </div>

        <div className="card">
          {loading ? (
            <Loading />
          ) : (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>User</th>
                      <th>Action</th>
                      <th>Module</th>
                      <th>Target</th>
                      <th>IP</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(data?.logs || []).map((l) => (
                      <tr key={l.id}>
                        <td
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "0.75rem",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatDate(l.created_at)}
                        </td>

                        <td style={{ fontWeight: 500, fontSize: "0.82rem" }}>
                          {l.username}
                        </td>

                        <td style={{ fontSize: "0.78rem" }}>
                          {l.action?.replace(/_/g, " ")}
                        </td>

                        <td
                          style={{
                            fontSize: "0.78rem",
                            color: "var(--text-2)",
                          }}
                        >
                          {l.module}
                        </td>

                        <td style={{ fontSize: "0.78rem" }}>
                          {l.target || "—"}
                        </td>

                        <td
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "0.72rem",
                            color: "var(--text-3)",
                          }}
                        >
                          {l.ip_address || "—"}
                        </td>

                        <td>
                          <span
                            className={`badge ${
                              l.status === "success"
                                ? "badge-online"
                                : "badge-down"
                            }`}
                          >
                            {l.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {(!data?.logs || data.logs.length === 0) && (
                  <Empty text="No audit logs found" />
                )}
              </div>

              <div style={{ padding: "0 16px" }}>
                <Pagination
                  page={page}
                  total={data?.total || 0}
                  limit={50}
                  onChange={setPage}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <Modal
        open={settingsModal}
        onClose={() => setSettingsModal(false)}
        title="Audit Log Settings"
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setSettingsModal(false)}
            >
              Cancel
            </button>

            <button
              className="btn btn-secondary"
              onClick={clearOldLogs}
              disabled={clearingLogs}
            >
              {clearingLogs ? "Clearing..." : "Clear Old Logs"}
            </button>

            <button
              className="btn btn-danger"
              onClick={clearAllLogsNow}
              disabled={clearingAllLogs}
            >
              {clearingAllLogs ? "Clearing..." : "Clear Now"}
            </button>

            <button
              className="btn btn-primary"
              onClick={saveSettings}
              disabled={savingSettings}
            >
              {savingSettings ? "Saving..." : "Save Settings"}
            </button>
          </>
        }
      >
        <div style={{ display: "grid", gap: 14 }}>
          <div
            style={{
              padding: 14,
              border: "1px solid var(--border)",
              borderRadius: 12,
              background: "var(--bg-2)",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
                fontSize: "0.88rem",
                fontWeight: 600,
              }}
            >
              <input
                type="checkbox"
                checked={settingsForm.audit_auto_clear_enabled === "true"}
                onChange={(e) =>
                  setSettingsForm((p) => ({
                    ...p,
                    audit_auto_clear_enabled: e.target.checked ? "true" : "false",
                  }))
                }
              />
              Enable auto clear audit logs
            </label>

            <div
              style={{
                marginTop: 6,
                fontSize: "0.78rem",
                color: "var(--text-3)",
              }}
            >
              When enabled, old audit logs will be deleted automatically based on
              selected days.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Clear logs older than</label>
            <select
              className="form-input form-select"
              value={settingsForm.audit_auto_clear_days}
              onChange={(e) =>
                setSettingsForm((p) => ({
                  ...p,
                  audit_auto_clear_days: e.target.value,
                }))
              }
            >
              <option value="7">7 days</option>
              <option value="15">15 days</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
              <option value="180">180 days</option>
              <option value="365">365 days</option>
            </select>
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background: "rgba(239, 68, 68, 0.1)",
              color: "#991b1b",
              fontSize: "0.78rem",
              lineHeight: 1.5,
            }}
          >
            <b>Clear Now</b> will delete all audit logs immediately. A confirmation
            message will appear before deleting.
          </div>
        </div>
      </Modal>
    </div>
  );
}