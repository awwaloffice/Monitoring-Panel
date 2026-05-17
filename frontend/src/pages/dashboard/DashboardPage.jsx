import { useEffect, useMemo, useState } from "react";
import { useFetch } from "../../hooks";
import { dashboardApi } from "../../services/api";
import { SeverityBadge } from "../../components/ui";
import { formatDate } from "../../utils";

const BLINK_VISIBLE_MS = 5 * 60 * 1000;
const NOTE_STORAGE_KEY = "currentProblemNotes";

export default function DashboardPage() {
  const { data } = useFetch(() => dashboardApi.currentProblems(), [], 10);
  const [now, setNow] = useState(Date.now());
  const [search, setSearch] = useState("");
  const [noteModal, setNoteModal] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");

  const [notes, setNotes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(NOTE_STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getIssueKey = (row) =>
    [
      row.target_type || "target",
      row.target_id || row.target_name || "unknown",
      row.display_type || row.type || "issue",
    ].join("__");

  useEffect(() => {
  if (!Array.isArray(data) || data.length === 0) return;

  const activeKeys = new Set(
    data
      .filter((row) => String(row.state || "").toLowerCase() !== "up")
      .map(getIssueKey),
  );

  setNotes((prev) => {
    const next = {};

    Object.entries(prev).forEach(([key, value]) => {
      if (activeKeys.has(key)) {
        next[key] = value;
      }
    });

    localStorage.setItem(NOTE_STORAGE_KEY, JSON.stringify(next));
    return next;
  });
}, [data]);

  const handleNoteChange = (row, value) => {
    const key = getIssueKey(row);

    setNotes((prev) => {
      const next = {
        ...prev,
        [key]: value,
      };

      if (!value.trim()) {
        delete next[key];
      }

      localStorage.setItem(NOTE_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const openNoteModal = (row) => {
    const key = getIssueKey(row);
    setNoteModal(row);
    setNoteDraft(notes[key] || "");
  };

  const closeNoteModal = () => {
    setNoteModal(null);
    setNoteDraft("");
  };

  const saveNoteModal = () => {
    if (!noteModal) return;
    handleNoteChange(noteModal, noteDraft);
    closeNoteModal();
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = (data || []).slice(0, 50);

    if (q) {
      list = list.filter((row) => {
        const text = [
          row.target_name,
          row.display_message,
          row.display_type,
          row.type,
          row.state,
          row.severity,
          row.target_type,
          notes[getIssueKey(row)],
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return text.includes(q);
      });
    }

    return list;
  }, [data, search, notes]);

  const activeRows = rows.filter((r) => r.state !== "up");

  const criticalCount = activeRows.filter(
    (r) => String(r.severity || "").toLowerCase() === "critical",
  ).length;

  const warningCount = activeRows.filter(
    (r) => String(r.severity || "").toLowerCase() === "warning",
  ).length;

  const lastUpdateTime = useMemo(() => {
    const times = (data || [])
      .map((r) =>
        Date.parse(
          r.last_checked_at ||
            r.updated_at ||
            r.state_started_at ||
            r.created_at,
        ),
      )
      .filter((t) => Number.isFinite(t));

    if (!times.length) return null;

    return Math.max(...times);
  }, [data]);

  const lastUpdateText = lastUpdateTime
    ? `Last update : ${formatClockTime(lastUpdateTime)}`
    : "Last update : No data";

  return (
    <div>
      <style>
        {`
          @keyframes solvedBlink {
            0% { background-color: rgba(34, 197, 94, 0.06); }
            50% { background-color: rgba(34, 197, 94, 0.22); }
            100% { background-color: rgba(34, 197, 94, 0.06); }
          }

          @keyframes criticalBlink {
            0% { background-color: rgba(239, 68, 68, 0.05); }
            50% { background-color: rgba(239, 68, 68, 0.18); }
            100% { background-color: rgba(239, 68, 68, 0.05); }
          }

          @keyframes warningBlink {
            0% { background-color: rgba(245, 158, 11, 0.05); }
            50% { background-color: rgba(245, 158, 11, 0.18); }
            100% { background-color: rgba(245, 158, 11, 0.05); }
          }

          .solved-blink-row {
            animation: solvedBlink 1.4s ease-in-out infinite;
          }

          .critical-blink-row {
            animation: criticalBlink 1.4s ease-in-out infinite;
          }

          .warning-blink-row {
            animation: warningBlink 1.4s ease-in-out infinite;
          }

          .dashboard-top {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .dashboard-title {
            font-size: 1.02rem;
            font-weight: 850;
            color: var(--text);
            line-height: 1.2;
          }

          .dashboard-subtitle {
            margin-top: 7px;
            font-size: 0.78rem;
            color: var(--text-3);
            line-height: 1.45;
          }

          .dashboard-controls-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
            flex-wrap: wrap;
          }

          .dashboard-search-wrap {
            position: relative;
            width: 360px;
            max-width: 100%;
            flex: 0 0 360px;
          }

          .dashboard-search-icon {
            position: absolute;
            left: 15px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-3);
            font-size: 0.9rem;
            pointer-events: none;
          }

          .dashboard-search-input {
            width: 100%;
            height: 42px;
            border-radius: 16px;
            border: 1px solid rgba(148, 163, 184, 0.34);
            background: rgba(255, 255, 255, 0.9);
            padding: 0 42px 0 42px;
            font-size: 0.84rem;
            color: var(--text);
            outline: none;
            transition: all 0.18s ease;
            box-shadow: 0 8px 22px rgba(15, 23, 42, 0.045);
          }

          .dashboard-search-input:focus {
            border-color: var(--primary);
            background: #fff;
            box-shadow:
              0 0 0 3px rgba(37, 99, 235, 0.1),
              0 12px 26px rgba(15, 23, 42, 0.06);
          }

          .dashboard-search-input::placeholder {
            color: var(--text-3);
          }

          .dashboard-search-clear {
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            border: none;
            background: rgba(148, 163, 184, 0.15);
            color: var(--text-3);
            width: 24px;
            height: 24px;
            border-radius: 999px;
            cursor: pointer;
            font-size: 0.78rem;
            line-height: 1;
          }

          .dashboard-search-clear:hover {
            background: rgba(239, 68, 68, 0.12);
            color: var(--down);
          }

          .dashboard-pills {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
            justify-content: flex-start;
            flex: 1;
            min-width: 320px;
          }

          .message-note-grid {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 38px;
            align-items: center;
            gap: 10px;
            width: 100%;
          }

          .message-text {
            min-width: 0;
            color: var(--text-2);
            line-height: 1.42;
            word-break: break-word;
            overflow-wrap: anywhere;
          }

          .note-slot {
            width: 38px;
            display: flex;
            justify-content: center;
            align-items: center;
          }

          .note-action-btn {
            width: 30px;
            height: 30px;
            border-radius: 11px;
            border: 1px solid rgba(37, 99, 235, 0.16);
            background: rgba(37, 99, 235, 0.07);
            color: var(--primary);
            cursor: pointer;
            transition: all 0.16s ease;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0;
          }

          .note-action-btn:hover {
            background: rgba(37, 99, 235, 0.13);
            border-color: rgba(37, 99, 235, 0.28);
            transform: translateY(-1px);
          }

          .note-action-btn.has-note {
            border-color: rgba(245, 158, 11, 0.3);
            background: rgba(245, 158, 11, 0.13);
            color: var(--warning);
          }

          .note-action-btn svg {
            display: block;
          }

          .note-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.38);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            padding: 18px;
          }

          .note-modal-card {
            width: 460px;
            max-width: 100%;
            border-radius: 22px;
            background: #fff;
            box-shadow: 0 24px 70px rgba(15, 23, 42, 0.22);
            border: 1px solid rgba(226, 232, 240, 0.95);
            overflow: hidden;
          }

          .note-modal-header {
            padding: 18px 20px;
            border-bottom: 1px solid var(--border-light);
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 14px;
          }

          .note-modal-title {
            font-size: 0.95rem;
            font-weight: 900;
            color: var(--text);
          }

          .note-modal-subtitle {
            margin-top: 5px;
            font-size: 0.78rem;
            color: var(--text-3);
            line-height: 1.35;
          }

          .note-modal-close {
            width: 32px;
            height: 32px;
            border-radius: 999px;
            border: none;
            background: rgba(148, 163, 184, 0.14);
            color: var(--text-2);
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2rem;
            line-height: 1;
          }

          .note-modal-close:hover {
            background: rgba(239, 68, 68, 0.12);
            color: var(--down);
          }

          .note-modal-body {
            padding: 18px 20px;
          }

          .note-modal-textarea {
            width: 100%;
            min-height: 150px;
            resize: vertical;
            border: 1px solid rgba(148, 163, 184, 0.34);
            border-radius: 16px;
            padding: 13px 14px;
            font-size: 0.84rem;
            color: var(--text);
            outline: none;
            line-height: 1.5;
          }

          .note-modal-textarea:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
          }

          .note-modal-footer {
            padding: 14px 20px 18px;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
          }

          .note-modal-cancel,
          .note-modal-save {
            height: 36px;
            padding: 0 14px;
            border-radius: 12px;
            border: none;
            cursor: pointer;
            font-size: 0.78rem;
            font-weight: 800;
          }

          .note-modal-cancel {
            background: rgba(148, 163, 184, 0.16);
            color: var(--text-2);
          }

          .note-modal-save {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            background: var(--primary);
            color: #fff;
          }

          @media (max-width: 1100px) {
            .dashboard-search-wrap {
              width: 100%;
              flex: 1 1 100%;
            }

            .dashboard-pills {
              min-width: 100%;
            }
          }
        `}
      </style>

      <div className="page-content">
        <div
          className="card"
          style={{
            overflow: "hidden",
            border: "1px solid var(--border)",
            boxShadow: "0 14px 35px rgba(15, 23, 42, 0.06)",
          }}
        >
          <div
            style={{
              padding: "22px 26px 20px",
              borderBottom: "1px solid var(--border-light)",
              background:
                "linear-gradient(135deg, rgba(37, 99, 235, 0.055), rgba(255, 255, 255, 0.96))",
            }}
          >
            <div className="dashboard-top">
              <div>
                <div className="dashboard-title">Current Problems</div>
                <div className="dashboard-subtitle">
                  One latest row per target. New down and solved states blink
                  for 5 minutes.
                </div>
              </div>

              <div className="dashboard-controls-row">
                <div className="dashboard-search-wrap">
                  <span className="dashboard-search-icon">⌕</span>

                  <input
                    className="dashboard-search-input"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search target, type, message, note..."
                  />

                  {search && (
                    <button
                      type="button"
                      className="dashboard-search-clear"
                      onClick={() => setSearch("")}
                      title="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="dashboard-pills">
                  <span
                    style={pillStyle("var(--down)", "rgba(239, 68, 68, 0.1)")}
                  >
                    ● {criticalCount} Critical
                  </span>

                  <span
                    style={pillStyle(
                      "var(--warning)",
                      "rgba(245, 158, 11, 0.12)",
                    )}
                  >
                    ● {warningCount} Warning
                  </span>

                  <span
                    style={pillStyle(
                      "var(--online)",
                      "rgba(148, 163, 184, 0.14)",
                    )}
                  >
                    Total {rows.length}
                  </span>

                  <span
                    style={pillStyle(
                      "var(--primary)",
                      "rgba(37, 99, 235, 0.1)",
                    )}
                  >
                    {lastUpdateText}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="table-wrap">
            <table
              className="data-table"
              style={{
                width: "100%",
                tableLayout: "fixed",
                borderCollapse: "separate",
                borderSpacing: 0,
              }}
            >
              <thead>
                <tr>
                  <th style={{ width: "15%" }}>Time</th>
                  <th style={{ width: "10%" }}>Severity</th>
                  <th style={{ width: "8%" }}>Duration</th>
                  <th style={{ width: "12%" }}>Type</th>
                  <th style={{ width: "16%" }}>Target</th>
                  <th style={{ width: "30%" }}>Message</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => {
                  const state = String(row.state || "").toLowerCase();
                  const severity = String(row.severity || "").toLowerCase();
                  const isSolved = state === "up";
                  const issueKey = getIssueKey(row);

                  const stateTime = Number(
                    row._state_time ||
                      Date.parse(
                        row.state_started_at || row.created_at || new Date(),
                      ),
                  );

                  const durationMs = Math.max(0, now - stateTime);
                  const shouldBlink = durationMs <= BLINK_VISIBLE_MS;

                  const rowClass =
                    isSolved && shouldBlink
                      ? "solved-blink-row"
                      : !isSolved && shouldBlink && severity === "critical"
                        ? "critical-blink-row"
                        : !isSolved && shouldBlink && severity === "warning"
                          ? "warning-blink-row"
                          : "";

                  return (
                    <tr
                      key={`${row.target_type}-${row.target_id}-${row.state_started_at}`}
                      className={rowClass}
                    >
                      <td
                        style={{
                          position: "relative",
                          fontFamily: "var(--font-mono)",
                          fontSize: "0.75rem",
                          whiteSpace: "nowrap",
                          color: "var(--text-2)",
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            left: 0,
                            top: 10,
                            bottom: 10,
                            width: 3,
                            borderRadius: 999,
                            background: isSolved
                              ? "var(--online)"
                              : severity === "critical"
                                ? "var(--down)"
                                : severity === "warning"
                                  ? "var(--warning)"
                                  : "var(--primary)",
                          }}
                        />

                        <span style={{ paddingLeft: 10 }}>
                          {formatDate(row.state_started_at || row.created_at)}
                        </span>
                      </td>

                      <td>
                        {isSolved ? (
                          <span className="badge badge-online">SOLVED</span>
                        ) : (
                          <SeverityBadge severity={row.severity} />
                        )}
                      </td>

                      <td
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "0.75rem",
                          color: isSolved ? "var(--online)" : "var(--text-2)",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatDuration(durationMs)}
                      </td>

                      <td
                        style={{
                          fontSize: "0.78rem",
                          textTransform: "capitalize",
                          color: "var(--text)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          paddingRight: 4,
                        }}
                        title={row.display_type || "—"}
                      >
                        {row.display_type || "—"}
                      </td>

                      <td
                        style={{
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          color: "var(--text)",
                          whiteSpace: "normal",
                          overflow: "visible",
                          textOverflow: "unset",
                          wordBreak: "break-word",
                          overflowWrap: "anywhere",
                          lineHeight: 1.32,
                          paddingLeft: 2,
                          paddingRight: 2,
                        }}
                        title={row.target_name || "—"}
                      >
                        {row.target_name || "—"}
                      </td>

                      <td
  style={{
    fontSize: "0.8rem",
    paddingLeft: 0,
    paddingRight: 15,
  }}
  title={row.display_message || "—"}
>
                        <div className="message-note-grid">
                          <span className="message-text">
                            {row.display_message || "—"}
                          </span>

                          <span className="note-slot">
                            {!isSolved && (
                              <button
                                type="button"
                                className={`note-action-btn ${
                                  notes[issueKey] ? "has-note" : ""
                                }`}
                                onClick={() => openNoteModal(row)}
                                title={
                                  notes[issueKey] ? "View note" : "Add note"
                                }
                              >
                                {notes[issueKey] ? <ViewIcon /> : <NoteIcon />}
                              </button>
                            )}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div
                        style={{
                          padding: "56px 20px",
                          textAlign: "center",
                          color: "var(--text-3)",
                        }}
                      >
                        <div style={{ fontSize: 34, marginBottom: 10 }}>✅</div>

                        <div
                          style={{
                            fontWeight: 800,
                            color: "var(--text)",
                            marginBottom: 4,
                          }}
                        >
                          No active problems
                        </div>

                        <div style={{ fontSize: "0.82rem" }}>
                          Active problems and recent solved states are clear.
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {noteModal && (
        <div className="note-modal-overlay" onClick={closeNoteModal}>
          <div className="note-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="note-modal-header">
              <div>
                <div className="note-modal-title">Issue Root Cause Note</div>
                <div className="note-modal-subtitle">
                  {noteModal.target_name || "Unknown target"} ·{" "}
                  {noteModal.display_type || "Issue"}
                </div>
              </div>

              <button
                type="button"
                className="note-modal-close"
                onClick={closeNoteModal}
                title="Close"
              >
                ×
              </button>
            </div>

            <div className="note-modal-body">
              <textarea
                className="note-modal-textarea"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Write issue root cause note here..."
                autoFocus
              />
            </div>

            <div className="note-modal-footer">
              <button
                type="button"
                className="note-modal-cancel"
                onClick={closeNoteModal}
              >
                Cancel
              </button>

              <button
                type="button"
                className="note-modal-save"
                onClick={saveNoteModal}
              >
                <SaveIcon />
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "0s";

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatClockTime(time) {
  return new Date(time).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function NoteIcon() {
  return (
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
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </svg>
  );
}

function ViewIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function SaveIcon() {
  return (
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
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </svg>
  );
}

const pillStyle = (color, background) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 11px",
  borderRadius: 999,
  background,
  color,
  fontSize: "0.75rem",
  fontWeight: 800,
  whiteSpace: "nowrap",
});