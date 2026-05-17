import { useState } from "react";
import { useFetch } from "../../hooks";
import { usersApi, auditApi } from "../../services/api";
import { StatusBadge, Loading, Empty, Modal, Confirm, Pagination } from "../../components/ui";
import { formatDate } from "../../utils";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";

const ROLES = ["full_access", "write", "readonly"];
const EMPTY_USER = { name: "", username: "", password: "", role: "readonly", status: "active" };

export function UserManagementPage() {
  const { isAdmin } = useAuth();
  const { data, loading, refetch } = useFetch(() => usersApi.list(), []);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_USER);
  const [del, setDel] = useState(null);
  const [saving, setSaving] = useState(false);

  if (!isAdmin()) return <div className="page-content"><div className="card card-body" style={{ padding: 32, textAlign: "center", color: "var(--text-3)" }}>Admin access required.</div></div>;

  const openAdd = () => { setForm(EMPTY_USER); setEditing(null); setModal(true); };
  const openEdit = (u) => { setForm({ ...u, password: "" }); setEditing(u.id); setModal(true); };
  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.name || !form.username) return toast.error("Name and username required");
    if (!editing && !form.password) return toast.error("Password required for new user");
    setSaving(true);
    try {
      editing ? await usersApi.update(editing, form) : await usersApi.create(form);
      toast.success(editing ? "User updated" : "User created");
      setModal(false); refetch();
    } catch (err) { toast.error(err?.response?.data?.error || "Failed"); }
    finally { setSaving(false); }
  };

  const del_ = async () => {
    try { await usersApi.delete(del); toast.success("Deleted"); setDel(null); refetch(); }
    catch (e) { toast.error(e?.response?.data?.error || "Failed"); }
  };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">User Management</div><div className="page-subtitle">Manage user accounts and roles</div></div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add User</button>
      </div>
      <div className="page-content">
        <div className="card">
          {loading ? <Loading /> : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Enabled</th><th>Last Login</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody>
                  {(data || []).map((u) => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{u.name}</td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>{u.username}</td>
                      <td>
                        <span className={`badge ${u.role === "full_access" ? "badge-down" : u.role === "write" ? "badge-warning" : "badge-info"}`}>
                          {u.role.replace("_", " ")}
                        </span>
                      </td>
                      <td>
  <span className={`badge ${u.status === "active" ? "badge-online" : "badge-down"}`}>
    {u.status === "active" ? "YES" : "NO"}
  </span>
</td>
                      <td style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>{formatDate(u.last_login)}</td>
                      <td style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>{formatDate(u.created_at)}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => setDel(u.id)}>Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!data || data.length === 0) && <Empty />}
            </div>
          )}
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit User" : "Add User"}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</button></>}
      >
        <div className="form-group"><label className="form-label">Full Name *</label><input className="form-input" value={form.name} onChange={(e) => f("name", e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Username *</label><input className="form-input" value={form.username} onChange={(e) => f("username", e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Password {editing ? "(leave blank to keep)" : "*"}</label><input className="form-input" type="password" value={form.password} onChange={(e) => f("password", e.target.value)} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group"><label className="form-label">Role</label>
            <select className="form-input form-select" value={form.role} onChange={(e) => f("role", e.target.value)}>
              {ROLES.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Status</label>
            <select className="form-input form-select" value={form.status} onChange={(e) => f("status", e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </Modal>

      <Confirm open={!!del} onClose={() => setDel(null)} onConfirm={del_} title="Delete User" message="Are you sure you want to delete this user?" />
    </div>
  );
}

export default UserManagementPage;
