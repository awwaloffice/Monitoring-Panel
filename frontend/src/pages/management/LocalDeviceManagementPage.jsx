import { useMemo, useState } from "react";
import { useFetch } from "../../hooks";
import { devicesApi, routersApi } from "../../services/api";
import {
  StatusBadge,
  Loading,
  Empty,
  Modal,
  Confirm,
} from "../../components/ui";
import { deviceTypeIcon } from "../../utils";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";

const TYPES = [
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

const PRIORITIES = ["low", "medium", "high", "critical"];

const EMPTY = {
  name: "",
  ip: "",
  device_type: "Other",
  location: "",
  router_id: "",
  description: "",
  enabled: true,
  priority: "medium",
  warn_latency: 10,
  crit_latency: 50,
  loss_threshold: 20,
  check_interval: 30,
};

export default function LocalDeviceManagementPage() {
  const { canWrite } = useAuth();
  const { data, loading, refetch } = useFetch(() => devicesApi.list(), []);
  const { data: routers } = useFetch(() => routersApi.list(), []);

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [del, setDel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const [routerInput, setRouterInput] = useState("");
  const [routerDropdownOpen, setRouterDropdownOpen] = useState(false);

  const filteredDevices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data || [];

    return (data || []).filter((d) =>
      [
        d.name,
        d.ip,
        d.device_type,
        d.router_name,
        d.location,
        d.priority,
        d.description,
        d.enabled ? "enabled yes online" : "disabled no",
        d.warn_latency,
        d.crit_latency,
        d.loss_threshold,
        d.check_interval,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [data, search]);

  const filteredRouters = useMemo(() => {
    const q = routerInput.trim().toLowerCase();
    const list = routers || [];

    if (!q) return list;

    return list.filter((r) =>
      [r.name, r.ip, r.host, r.location]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [routers, routerInput]);

  const selectedRouter = useMemo(() => {
    if (!form.router_id) return null;
    return (routers || []).find((r) => String(r.id) === String(form.router_id));
  }, [routers, form.router_id]);

  const openAdd = () => {
    setForm(EMPTY);
    setRouterInput("");
    setRouterDropdownOpen(false);
    setEditing(null);
    setModal(true);
  };

  const openEdit = (d) => {
    setForm({ ...d, enabled: !!d.enabled });
    setRouterInput(d.router_name || "");
    setRouterDropdownOpen(false);
    setEditing(d.id);
    setModal(true);
  };

  const closeModal = () => {
    setModal(false);
    setRouterDropdownOpen(false);
  };

  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleRouterInput = (value) => {
    setRouterInput(value);
    setRouterDropdownOpen(true);

    const matchedRouter = (routers || []).find(
      (r) => String(r.name || "").toLowerCase() === value.toLowerCase(),
    );

    setForm((prev) => ({
      ...prev,
      router_id: matchedRouter ? matchedRouter.id : "",
    }));
  };

  const selectRouter = (router) => {
    setRouterInput(router.name || "");
    setForm((prev) => ({
      ...prev,
      router_id: router.id,
    }));
    setRouterDropdownOpen(false);
  };

  const clearRouter = () => {
    setRouterInput("");
    setForm((prev) => ({
      ...prev,
      router_id: "",
    }));
    setRouterDropdownOpen(false);
  };

  const save = async () => {
    if (!form.name || !form.ip) return toast.error("Name and IP required");

    setSaving(true);

    try {
      editing
        ? await devicesApi.update(editing, form)
        : await devicesApi.create(form);

      toast.success(editing ? "Device updated" : "Device created");
      closeModal();
      refetch();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const del_ = async () => {
    try {
      await devicesApi.delete(del);
      toast.success("Deleted");
      setDel(null);
      refetch();
    } catch {
      toast.error("Failed");
    }
  };

  const testPing = async (id) => {
    toast.promise(devicesApi.test(id), {
      loading: "Pinging from router...",
      success: (r) =>
        `Latency: ${r.data.avg_latency}ms, Loss: ${r.data.packet_loss}%`,
      error: (e) => e?.response?.data?.error || "Ping failed",
    });
  };

  return (
    <div>
      <style>
        {`
          .modern-router-select {
            position: relative;
          }

          .modern-router-input-wrap {
            position: relative;
            display: flex;
            align-items: center;
          }

          .modern-router-input {
            padding-right: 74px !important;
          }

          .modern-router-actions {
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            display: inline-flex;
            align-items: center;
            gap: 4px;
          }

          .modern-router-icon-btn {
            width: 26px;
            height: 26px;
            border: none;
            border-radius: 8px;
            background: rgba(148, 163, 184, 0.12);
            color: var(--text-3);
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s ease;
            font-size: 0.8rem;
            line-height: 1;
          }

          .modern-router-icon-btn:hover {
            background: rgba(37, 99, 235, 0.12);
            color: var(--primary);
          }

          .modern-router-dropdown {
            position: absolute;
            left: 0;
            right: 0;
            top: calc(100% + 6px);
            z-index: 99999;
            background: #fff;
            border: 1px solid rgba(226, 232, 240, 0.95);
            border-radius: 14px;
            box-shadow: 0 18px 40px rgba(15, 23, 42, 0.16);
            overflow: hidden;
            max-height: 220px;
            overflow-y: auto;
          }

          .modern-router-option {
            width: 100%;
            border: none;
            background: #fff;
            padding: 11px 13px;
            cursor: pointer;
            text-align: left;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            transition: all 0.14s ease;
          }

          .modern-router-option:hover {
            background: rgba(37, 99, 235, 0.075);
          }

          .modern-router-option.is-selected {
            background: rgba(37, 99, 235, 0.1);
          }

          .modern-router-name {
            font-size: 0.84rem;
            font-weight: 800;
            color: var(--text);
            line-height: 1.25;
          }

          .modern-router-meta {
            margin-top: 3px;
            font-size: 0.72rem;
            color: var(--text-3);
            line-height: 1.25;
          }

          .modern-router-check {
            flex: 0 0 auto;
            width: 22px;
            height: 22px;
            border-radius: 999px;
            background: rgba(37, 99, 235, 0.12);
            color: var(--primary);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 0.8rem;
            font-weight: 900;
          }

          .modern-router-empty {
            padding: 14px 13px;
            font-size: 0.8rem;
            color: var(--text-3);
            text-align: center;
          }

          .modern-router-selected-pill {
            margin-top: 7px;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 5px 9px;
            border-radius: 999px;
            background: rgba(34, 197, 94, 0.1);
            color: var(--online);
            font-size: 0.73rem;
            font-weight: 800;
          }
        `}
      </style>

      <div className="page-header">
        <div>
          <div className="page-title">Local Device Management</div>
          <div className="page-subtitle">
            Manage LAN devices to monitor via routers
          </div>
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
              placeholder="Search device..."
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
              + Add Device
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
                    <th>Device</th>
                    <th>IP</th>
                    <th>Type</th>
                    <th>Router</th>
                    <th>Location</th>
                    <th>Priority</th>
                    <th>Enabled</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredDevices.map((d) => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600 }}>
                        {deviceTypeIcon(d.device_type)} {d.name}
                      </td>

                      <td
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "0.8rem",
                        }}
                      >
                        {d.ip}
                      </td>

                      <td>{d.device_type}</td>

                      <td style={{ fontSize: "0.8rem" }}>
                        {d.router_name || "—"}
                      </td>

                      <td style={{ fontSize: "0.78rem" }}>
                        {d.location || "—"}
                      </td>

                      <td
                        style={{
                          textTransform: "capitalize",
                          fontSize: "0.78rem",
                        }}
                      >
                        {d.priority}
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

                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => testPing(d.id)}
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
                  ))}
                </tbody>
              </table>

              {filteredDevices.length === 0 && (
                <Empty
                  text={
                    search
                      ? "No devices matched your search"
                      : "No devices configured"
                  }
                />
              )}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={modal}
        onClose={closeModal}
        title={editing ? "Edit Device" : "Add Device"}
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeModal}>
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
          <label className="form-label">Device Name *</label>
          <input
            className="form-input"
            value={form.name}
            onChange={(e) => f("name", e.target.value)}
            placeholder="OLT-Main"
          />
        </div>

        <div className="form-group">
          <label className="form-label">IP Address *</label>
          <input
            className="form-input"
            value={form.ip}
            onChange={(e) => f("ip", e.target.value)}
            placeholder="192.168.1.100"
          />
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <div className="form-group">
            <label className="form-label">Device Type</label>
            <select
              className="form-input form-select"
              value={form.device_type}
              onChange={(e) => f("device_type", e.target.value)}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Priority</label>
            <select
              className="form-input form-select"
              value={form.priority}
              onChange={(e) => f("priority", e.target.value)}
            >
              {PRIORITIES.map((p) => (
                <option
                  key={p}
                  value={p}
                  style={{ textTransform: "capitalize" }}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group modern-router-select">
            <label className="form-label">Source Router</label>

            <div className="modern-router-input-wrap">
              <input
                className="form-input modern-router-input"
                value={routerInput}
                onFocus={() => setRouterDropdownOpen(true)}
                onChange={(e) => handleRouterInput(e.target.value)}
                onBlur={() => {
                  setTimeout(() => setRouterDropdownOpen(false), 150);
                }}
                placeholder="Type or select router..."
                autoComplete="off"
              />

              <div className="modern-router-actions">
                {routerInput && (
                  <button
                    type="button"
                    className="modern-router-icon-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={clearRouter}
                    title="Clear router"
                  >
                    ×
                  </button>
                )}

                <button
                  type="button"
                  className="modern-router-icon-btn"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setRouterDropdownOpen((p) => !p)}
                  title="Show routers"
                >
                  ▾
                </button>
              </div>
            </div>

            {selectedRouter && (
              <div className="modern-router-selected-pill">
                ● Selected: {selectedRouter.name}
              </div>
            )}

            {routerDropdownOpen && (
              <div className="modern-router-dropdown">
                {filteredRouters.length > 0 ? (
                  filteredRouters.map((r) => {
                    const isSelected =
                      String(form.router_id) === String(r.id);

                    return (
                      <button
                        key={r.id}
                        type="button"
                        className={`modern-router-option ${
                          isSelected ? "is-selected" : ""
                        }`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectRouter(r)}
                      >
                        <span>
                          <div className="modern-router-name">{r.name}</div>
                          <div className="modern-router-meta">
                            {r.ip || r.host || "No IP"}{" "}
                            {r.location ? `· ${r.location}` : ""}
                          </div>
                        </span>

                        {isSelected && (
                          <span className="modern-router-check">✓</span>
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="modern-router-empty">No router found</div>
                )}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Location/POP</label>
            <input
              className="form-input"
              value={form.location}
              onChange={(e) => f("location", e.target.value)}
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
            <label className="form-label">Loss Threshold (%)</label>
            <input
              className="form-input"
              type="number"
              value={form.loss_threshold}
              onChange={(e) => f("loss_threshold", +e.target.value)}
            />
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
          />{" "}
          Enabled
        </label>
      </Modal>

      <Confirm
        open={!!del}
        onClose={() => setDel(null)}
        onConfirm={del_}
        title="Delete Device"
        message="Delete this device and all its monitoring data?"
      />
    </div>
  );
}