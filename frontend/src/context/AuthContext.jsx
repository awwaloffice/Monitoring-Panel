import { createContext, useContext, useState, useEffect } from "react";
import { authApi } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      authApi.me()
        .then((res) => setUser(res.data))
        .catch(() => { localStorage.removeItem("token"); localStorage.removeItem("user"); setUser(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const res = await authApi.login({ username, password });
    localStorage.setItem("token", res.data.token);
    localStorage.setItem("user", JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = async () => {
    try { await authApi.logout(); } catch {}
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  const canWrite = () => user?.role === "full_access" || user?.role === "write";
  const isAdmin = () => user?.role === "full_access";

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, canWrite, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
