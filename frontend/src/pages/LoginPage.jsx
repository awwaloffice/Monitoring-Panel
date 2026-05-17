import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);

  if (user) { navigate("/dashboard"); return null; }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) return toast.error("Enter username and password");
    setLoading(true);
    try {
      await login(form.username, form.password);
      navigate("/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logo}>
          <div style={styles.logoIcon}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div>
            <div style={styles.logoTitle}>Monitoring Panel</div>
          </div>
        </div>

        <h1 style={styles.heading}>Sign in to your account</h1>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              className="form-input"
              type="text"
              placeholder="admin"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%", justifyContent: "center", padding: "10px" }}>
            {loading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : "Sign In"}
          </button>
        </form>

        <div style={styles.hint}>
          <strong>Forgot your password? Please contact the app administrator.</strong>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    background: "#fff",
    borderRadius: 16,
    padding: "36px 40px",
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
  },
  logo: { display: "flex", alignItems: "center", gap: 12, marginBottom: 28 },
  logoIcon: {
    width: 44, height: 44,
    background: "var(--primary)",
    borderRadius: 12,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  logoTitle: { fontSize: "1.1rem", fontWeight: 700, color: "var(--text)" },
  logoSub: { fontSize: "0.72rem", color: "var(--text-3)", marginTop: 1 },
  heading: { fontSize: "1.1rem", fontWeight: 600, color: "var(--text)", marginBottom: 20 },
  form: { display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 },
  hint: {
    fontSize: "0.75rem",
    color: "var(--text-3)",
    background: "var(--surface-2)",
    padding: "8px 12px",
    borderRadius: 6,
    marginBottom: 16,
  },
  features: { display: "flex", flexDirection: "column", gap: 6 },
  feature: { display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "var(--text-3)" },
};
