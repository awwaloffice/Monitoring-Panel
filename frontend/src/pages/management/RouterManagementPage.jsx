import { useMemo, useState } from "react";
import { useFetch } from "../../hooks";
import { routersApi } from "../../services/api";
import { StatusBadge, Loading, Empty, Modal, Confirm } from "../../components/ui";
import { formatDate } from "../../utils";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";

const EMPTY_FORM = {
  name: "",
  host: "",
  api_username: "admin",
  api_password: "",
  api_port: 8728,
  api_ssl: false,
  location: "",
  description: "",
  enabled: true,
  ping_source_mode: "none",
  ping_src_address: "",
  ping_src_interface: "",
};
export default function RouterManagementPage() {
  const { canWrite } = useAuth();
  const { data, loading, refetch } = useFetch(() => routersApi.list(), []);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [del, setDel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

const filteredRouters = useMemo(() => {
  const q = search.trim().toLowerCase();
  if (!q) return data || [];

  return (data || []).filter((r) =>
    [
      r.name,
      r.host,
      r.location,
      r.description,
      r.connection_status,
      r.api_port,
      r.api_ssl ? "ssl yes" : "ssl no",
      r.enabled ? "enabled yes" : "disabled no",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q)
  );
}, [data, search]);

  const openAdd = () => { setForm(EMPTY_FORM); setEditing(null); setModal(true); };
const openEdit = (r) => {
  let mode = "none";
  if (r.ping_src_address) mode = "address";
  if (r.ping_src_interface) mode = "interface";

  setForm({
    ...r,
    api_ssl: !!r.api_ssl,
    enabled: !!r.enabled,
    ping_source_mode: mode,
    ping_src_address: r.ping_src_address || "",
    ping_src_interface: r.ping_src_interface || "",
  });

  setEditing(r.id);
  setModal(true);
};
  const save = async () => {
    if (!form.name || !form.host || !form.api_username) return toast.error("Name, host, username required");
    setSaving(true);
    try {
  const payload = {
    ...form,
    ping_src_address: form.ping_source_mode === "address" ? form.ping_src_address : "",
    ping_src_interface: form.ping_source_mode === "interface" ? form.ping_src_interface : "",
  };

  if (editing) {
    await routersApi.update(editing, payload);
        toast.success("Router updated");
      } else {
        await routersApi.create(payload);
        toast.success("Router created");
      }
      setModal(false); refetch();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to save");
    } finally { setSaving(false); }
  };

  const deleteRouter = async () => {
    try { await routersApi.delete(del); toast.success("Router deleted"); setDel(null); refetch(); }
    catch { toast.error("Failed to delete"); }
  };

  const testConn = async (id) => {
    toast.promise(routersApi.test(id), {
      loading: "Testing...",
      success: (res) => res.data.success ? `✅ Connected: ROS ${res.data.version}` : `❌ Failed: ${res.data.error}`,
      error: "Test failed",
    }).then(() => refetch());
  };

  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div>
      <div className="page-header">
  <div>
    <div className="page-title">Router Management</div>
    <div className="page-subtitle">Add and manage source routers</div>
  </div>

  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
    <div
      style={{
        width: 260,
        height: 42,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 12px",
        border: "1px solid var(--border)",
        borderRadius: 12,
        background: "var(--card)",
      }}
    >
      <span style={{ color: "var(--text-3)", fontSize: "0.9rem" }}>⌕</span>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search router..."
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
        + Add Router
      </button>
    )}
  </div>
</div>

      <div className="page-content">
        <div className="card">
          {loading ? <Loading /> : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Name</th><th>Host</th><th>Location</th><th>API Status</th><th>SSL</th><th>Enabled</th><th>Last Seen</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filteredRouters.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.name}</td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>{r.host}:{r.api_port}</td>
                      <td>{r.location || "—"}</td>
                      <td><StatusBadge status={r.connection_status === "connected" ? "online" : "down"} /></td>
                      <td>{r.api_ssl ? "Yes" : "No"}</td>
                      <td>
  <span
    className={`badge ${r.enabled ? "badge-online" : "badge-down"}`}
  >
    {r.enabled ? "YES" : "NO"}
  </span>
</td>
                      <td style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>{formatDate(r.last_seen)}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => testConn(r.id)}>Test</button>
                          {canWrite() && <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}>Edit</button>}
                          {canWrite() && <button className="btn btn-danger btn-sm" onClick={() => setDel(r.id)}>Del</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredRouters.length === 0 && (
  <Empty text={search ? "No routers matched your search" : "No routers configured"} />
)}
            </div>
          )}
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit Router" : "Add Router"}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</button></>}
      >
        <div className="form-group"><label className="form-label">Router Name *</label><input className="form-input" value={form.name} onChange={(e) => f("name", e.target.value)} placeholder="Core-Router-01" /></div>
        <div className="form-group"><label className="form-label">Host / IP *</label><input className="form-input" value={form.host} onChange={(e) => f("host", e.target.value)} placeholder="192.168.1.1" /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group"><label className="form-label">API Username *</label><input className="form-input" value={form.api_username} onChange={(e) => f("api_username", e.target.value)} /></div>
          <div className="form-group"><label className="form-label">API Password</label><input className="form-input" type="password" value={form.api_password} onChange={(e) => f("api_password", e.target.value)} /></div>
          <div className="form-group"><label className="form-label">API Port</label><input className="form-input" type="number" value={form.api_port} onChange={(e) => f("api_port", +e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Location/POP</label><input className="form-input" value={form.location} onChange={(e) => f("location", e.target.value)} /></div>
        </div>
        <div className="form-group"><label className="form-label">Description</label><input className="form-input" value={form.description} onChange={(e) => f("description", e.target.value)} /></div>
<div className="form-group">
  <label className="form-label">Ping Source Mode</label>
  <select
    className="form-input"
    value={form.ping_source_mode}
    onChange={(e) => {
      const mode = e.target.value;
      setForm((p) => ({
        ...p,
        ping_source_mode: mode,
        ping_src_address: mode === "address" ? p.ping_src_address : "",
        ping_src_interface: mode === "interface" ? p.ping_src_interface : "",
      }));
    }}
  >
    <option value="none">Without Source / Router Default</option>
    <option value="address">Use Source Address</option>
    <option value="interface">Use Source Interface</option>
  </select>
</div>

{form.ping_source_mode === "address" && (
  <div className="form-group">
    <label className="form-label">Ping Source Address</label>
    <input
      className="form-input"
      value={form.ping_src_address}
      onChange={(e) => f("ping_src_address", e.target.value)}
      placeholder="Example: 192.168.1.1"
    />
    <div style={{ fontSize: "0.75rem", color: "var(--text-3)", marginTop: 4 }}>
      MikroTik command example: /ping 8.8.8.8 src-address=192.168.1.1
    </div>
  </div>
)}

{form.ping_source_mode === "interface" && (
  <div className="form-group">
    <label className="form-label">Ping Source Interface</label>
    <input
      className="form-input"
      value={form.ping_src_interface}
      onChange={(e) => f("ping_src_interface", e.target.value)}
      placeholder="Example: ether1 or pppoe-out1"
    />
    <div style={{ fontSize: "0.75rem", color: "var(--text-3)", marginTop: 4 }}>
      MikroTik command example: /ping 8.8.8.8 interface=pppoe-out1
    </div>
  </div>
)}        <div style={{ display: "flex", gap: 16 }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: "0.82rem", cursor: "pointer" }}>
            <input type="checkbox" checked={form.api_ssl} onChange={(e) => f("api_ssl", e.target.checked)} /> Use SSL API (port 8729)
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: "0.82rem", cursor: "pointer" }}>
            <input type="checkbox" checked={form.enabled} onChange={(e) => f("enabled", e.target.checked)} /> Enabled
          </label>
        </div>
      </Modal>

      <Confirm open={!!del} onClose={() => setDel(null)} onConfirm={deleteRouter} title="Delete Router" message="Are you sure you want to delete this router? All monitoring data will be lost." />
    </div>
  );
}
