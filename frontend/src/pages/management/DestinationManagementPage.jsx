import { useMemo, useState } from "react";
import { useFetch } from "../../hooks";
import { destinationsApi } from "../../services/api";
import { Loading, Empty, Modal, Confirm } from "../../components/ui";
import { groupColor } from "../../utils";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";

const GROUPS = ["GGC", "FNA", "Games", "CDN", "DNS", "IX", "Other"];

const EMPTY = {
  name: "",
  address: "",
  grp: "Other",
  description: "",
  enabled: true,
  warn_latency: 50,
  crit_latency: 150,
  warn_loss: 10,
  crit_loss: 50,
  check_interval: 60,
  packet_count: 5,
  timeout: 3000,
};

export default function DestinationManagementPage() {
  const { canWrite } = useAuth();
  const { data, loading, refetch } = useFetch(() => destinationsApi.list(), []);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [del, setDel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const filteredDestinations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data || [];

    return (data || []).filter((d) =>
      [
        d.name,
        d.address,
        d.grp,
        d.description,
        d.enabled ? "enabled yes online" : "disabled no",
        d.current_latency,
        d.last_latency,
        d.avg_latency,
        d.latency,
        d.warn_latency,
        d.crit_latency,
        d.warn_loss,
        d.crit_loss,
        d.check_interval,
        d.packet_count,
        d.timeout,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [data, search]);

  const openAdd = () => {
    setForm(EMPTY);
    setEditing(null);
    setModal(true);
  };

  const openEdit = (d) => {
    setForm({ ...d, enabled: !!d.enabled });
    setEditing(d.id);
    setModal(true);
  };

  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.name || !form.address) {
      return toast.error("Name and address required");
    }

    setSaving(true);

    try {
      editing
        ? await destinationsApi.update(editing, form)
        : await destinationsApi.create(form);

      toast.success(editing ? "Destination updated" : "Destination created");
      setModal(false);
      refetch();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const del_ = async () => {
    try {
      await destinationsApi.delete(del);
      toast.success("Deleted");
      setDel(null);
      refetch();
    } catch {
      toast.error("Failed");
    }
  };

  const testDest = async (id) => {
    toast.promise(destinationsApi.test(id, {}), {
      loading: "Pinging...",
      success: (r) =>
        `Latency: ${r.data.avg_latency}ms, Loss: ${r.data.packet_loss}%`,
      error: "Ping failed",
    });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Destination Management</div>
          <div className="page-subtitle">Manage destinations to monitor</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 280,
              height: 42,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 12px",
              border: "1px solid var(--border)",
              borderRadius: 12,
              background: "var(--card)",
              boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
            }}
          >
            <span style={{ color: "var(--text-3)", fontSize: "0.9rem" }}>
              ⌕
            </span>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search destination..."
              style={{
                width: "100%",
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: "0.86rem",
                color: "var(--text-1)",
              }}
            />

            {search && (
              <button
                onClick={() => setSearch("")}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "var(--text-3)",
                  fontSize: "1rem",
                  lineHeight: 1,
                  padding: 0,
                }}
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>

          {canWrite() && (
            <button className="btn btn-primary" onClick={openAdd}>
              + Add Destination
            </button>
          )}
        </div>
      </div>

      <div className="page-content">
        <div className="card">
          {loading ? (
            <Loading />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Address</th>
                    <th>Group</th>
                    <th>Enabled</th>
                    <th>Current Latency</th>
                    <th>Warn (ms)</th>
                    <th>Crit (ms)</th>
                    <th>Interval</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredDestinations.map((d) => {
                    const currentLatency =
                      d.current_latency ??
                      d.last_latency ??
                      d.avg_latency ??
                      d.latency ??
                      d.last_avg_latency ??
                      null;

                    return (
                      <tr key={d.id}>
                        <td style={{ fontWeight: 600 }}>{d.name}</td>

                        <td
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "0.8rem",
                          }}
                        >
                          {d.address}
                        </td>

                        <td>
                          <span
                            style={{
                              background: groupColor(d.grp) + "22",
                              color: groupColor(d.grp),
                              padding: "2px 8px",
                              borderRadius: 999,
                              fontSize: "0.72rem",
                              fontWeight: 600,
                            }}
                          >
                            {d.grp}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`badge ${
                              d.enabled ? "badge-online" : "badge-down"
                            }`}
                          >
                            {d.enabled ? "YES" : "NO"}
                          </span>
                        </td>

                        <td
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            color: getLatencyColor(
                              currentLatency,
                              d.warn_latency,
                              d.crit_latency,
                            ),
                          }}
                        >
                          {formatCurrentLatency(currentLatency)}
                        </td>

                        <td
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "0.8rem",
                          }}
                        >
                          {d.warn_latency}
                        </td>

                        <td
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "0.8rem",
                          }}
                        >
                          {d.crit_latency}
                        </td>

                        <td style={{ fontSize: "0.8rem" }}>
                          {d.check_interval}s
                        </td>

                        <td>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => testDest(d.id)}
                            >
                              Ping
                            </button>

                            {canWrite() && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => openEdit(d)}
                              >
                                Edit
                              </button>
                            )}

                            {canWrite() && (
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => setDel(d.id)}
                              >
                                Del
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredDestinations.length === 0 && (
                <Empty
                  text={
                    search
                      ? "No destinations matched your search"
                      : "No destinations configured"
                  }
                />
              )}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? "Edit Destination" : "Add Destination"}
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setModal(false)}
            >
              Cancel
            </button>

            <button
              className="btn btn-primary"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Name *</label>
          <input
            className="form-input"
            value={form.name}
            onChange={(e) => f("name", e.target.value)}
            placeholder="Google GGC"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Address (IP or domain) *</label>
          <input
            className="form-input"
            value={form.address}
            onChange={(e) => f("address", e.target.value)}
            placeholder="8.8.8.8"
          />
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <div className="form-group">
            <label className="form-label">Group</label>
            <select
              className="form-input form-select"
              value={form.grp}
              onChange={(e) => f("grp", e.target.value)}
            >
              {GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Check Interval (s)</label>
            <input
              className="form-input"
              type="number"
              value={form.check_interval}
              onChange={(e) => f("check_interval", +e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Warn Latency (ms)</label>
            <input
              className="form-input"
              type="number"
              value={form.warn_latency}
              onChange={(e) => f("warn_latency", +e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Crit Latency (ms)</label>
            <input
              className="form-input"
              type="number"
              value={form.crit_latency}
              onChange={(e) => f("crit_latency", +e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Warn Loss (%)</label>
            <input
              className="form-input"
              type="number"
              value={form.warn_loss}
              onChange={(e) => f("warn_loss", +e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Crit Loss (%)</label>
            <input
              className="form-input"
              type="number"
              value={form.crit_loss}
              onChange={(e) => f("crit_loss", +e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Packet Count</label>
            <input
              className="form-input"
              type="number"
              value={form.packet_count}
              onChange={(e) => f("packet_count", +e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Timeout (ms)</label>
            <input
              className="form-input"
              type="number"
              value={form.timeout}
              onChange={(e) => f("timeout", +e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Description</label>
          <input
            className="form-input"
            value={form.description}
            onChange={(e) => f("description", e.target.value)}
          />
        </div>

        <label
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            fontSize: "0.82rem",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => f("enabled", e.target.checked)}
          />
          Enabled
        </label>
      </Modal>

      <Confirm
        open={!!del}
        onClose={() => setDel(null)}
        onConfirm={del_}
        title="Delete Destination"
        message="Delete this destination and all its monitoring data?"
      />
    </div>
  );
}

function formatCurrentLatency(value) {
  if (value === null || value === undefined || value === "") return "—";

  const num = Number(value);
  if (!Number.isFinite(num)) return "—";

  return `${num.toFixed(1)} ms`;
}

function getLatencyColor(value, warn, crit) {
  const num = Number(value);
  const warnNum = Number(warn);
  const critNum = Number(crit);

  if (!Number.isFinite(num)) return "var(--text-3)";
  if (Number.isFinite(critNum) && num >= critNum) return "var(--down)";
  if (Number.isFinite(warnNum) && num >= warnNum) return "var(--warning)";
  return "var(--online)";
}