// BulkImportPage
import { useState } from "react";
import { bulkApi } from "../../services/api";
import toast from "react-hot-toast";

export function BulkImportPage() {
  const [tab, setTab] = useState("routers");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const TEMPLATES = {
routers:
  "name,host,username,password,apiPort,ssl,location,description,enabled,pingSourceMode,pingSourceAddress,pingSourceInterface\nCore-Router-01,192.168.1.1,admin,pass,8728,false,HQ,Core Router,true,address,192.168.1.1,\nRouter-02,192.168.2.1,admin,pass,8728,false,POP-2,Backup Router,true,interface,,pppoe-out1\nRouter-03,192.168.3.1,admin,pass,8728,false,POP-3,Default Source,true,none,,",    destinations: "name,address,group,description,warningLatency,criticalLatency,warningLoss,criticalLoss,enabled\nGoogle DNS,8.8.8.8,DNS,,50,150,10,50,true",
    devices: "name,ip,type,location,routerName,priority,description,enabled\nONU-001,192.168.10.1,ONU,POP-North,Core-Router-01,medium,,true",
  };

  const doPreview = async () => {
    if (!file) return toast.error("Select a CSV file first");
    setLoading(true); setResult(null);
    try {
      const fns = { routers: bulkApi.previewRouters, destinations: bulkApi.previewDestinations, devices: bulkApi.previewDevices };
      const res = await fns[tab](file);
      setPreview(res.data);
    } catch (e) { toast.error(e?.response?.data?.error || "Parse failed"); }
    finally { setLoading(false); }
  };

  const doImport = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      const fns = { routers: bulkApi.importRouters, destinations: bulkApi.importDestinations, devices: bulkApi.importDevices };
      const res = await fns[tab](file);
      setResult(res.data); setPreview(null);
      toast.success(`Imported ${res.data.imported} records`);
    } catch (e) { toast.error("Import failed"); }
    finally { setLoading(false); }
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATES[tab]], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${tab}-template.csv`; a.click();
  };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Bulk Import</div><div className="page-subtitle">Import routers, destinations, and devices via CSV</div></div>
      </div>
      <div className="page-content">
        <div className="tabs">
          {["routers", "destinations", "devices"].map((t) => (
            <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => { setTab(t); setFile(null); setPreview(null); setResult(null); }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Upload CSV File</span>
            <button className="btn btn-secondary btn-sm" onClick={downloadTemplate}>⬇ Download Template</button>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ border: "2px dashed var(--border)", borderRadius: 8, padding: "24px", textAlign: "center" }}>
              <input type="file" accept=".csv" onChange={(e) => { setFile(e.target.files[0]); setPreview(null); setResult(null); }} style={{ display: "block", margin: "0 auto" }} />
              <p style={{ fontSize: "0.78rem", color: "var(--text-3)", marginTop: 8 }}>CSV format only. Max 5MB.</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary" onClick={doPreview} disabled={!file || loading}>
                {loading ? "Processing..." : "Preview"}
              </button>
              {preview && (
                <button className="btn btn-primary" onClick={doImport} disabled={loading || preview.valid === 0}>
                  Import {preview.valid} valid rows
                </button>
              )}
            </div>
          </div>
        </div>

        {preview && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Preview</span>
              <span style={{ fontSize: "0.78rem" }}>
                <span style={{ color: "var(--online)" }}>✓ {preview.valid} valid</span>{" "}
                <span style={{ color: "var(--down)" }}>✗ {preview.total - preview.valid} errors</span>
              </span>
            </div>
            <div className="table-wrap" style={{ maxHeight: 400, overflowY: "auto" }}>
              <table className="data-table">
                <thead><tr>
                  {Object.keys(preview.rows[0] || {}).filter(k => !k.startsWith("_")).slice(0, 12).map(k => <th key={k}>{k}</th>)}
                  <th>Status</th>
                </tr></thead>
                <tbody>
                  {preview.rows.map((r, i) => (
                    <tr key={i} style={{ background: r._valid ? "" : "#fff5f5" }}>
                      {Object.entries(r).filter(([k]) => !k.startsWith("_")).slice(0, 12).map(([k, v]) => (
                        <td key={k} style={{ fontSize: "0.78rem" }}>{String(v || "")}</td>
                      ))}
                      <td>
                        {r._valid
                          ? <span className="badge badge-online">OK</span>
                          : <span className="badge badge-down">{r._errors.join(", ")}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {result && (
          <div className="card card-body">
            <p style={{ color: "var(--online)", fontWeight: 600 }}>✓ Successfully imported: {result.imported}</p>
            {result.errors?.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <p style={{ color: "var(--down)", fontWeight: 600 }}>✗ Errors:</p>
                {result.errors.map((e, i) => <p key={i} style={{ fontSize: "0.78rem", color: "var(--down)" }}>{e.row}: {e.error}</p>)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default BulkImportPage;
