"use client";

import { useState, useCallback, useMemo } from "react";
import UploadZone from "@/components/UploadZone";
import SqlEditor from "@/components/SqlEditor";
import ResultsTable from "@/components/ResultsTable";
import StatsSidebar from "@/components/StatsSidebar";
import ChatPanel from "@/components/ChatPanel";
import { uploadCSV, runQuery, fetchStats, StatsResponse, QueryResponse } from "@/lib/api";

interface TestStep {
  name: string;
  status: "pending" | "running" | "pass" | "fail";
  detail?: string;
}

export default function Home() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [sqlText, setSqlText] = useState("SELECT * FROM tablename LIMIT 10");
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [testSteps, setTestSteps] = useState<TestStep[] | null>(null);
  const [testRunning, setTestRunning] = useState(false);

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    try {
      await uploadCSV(file, (pct) => setUploadProgress(pct));
      const fullStats = await fetchStats();
      setStats(fullStats);
      setResult(null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }, []);

  const executeQuery = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setRunning(true);
    try {
      const data = await runQuery(query);
      setResult(data);
    } catch {
      setResult({ columns: [], rows: [], error: "Failed to connect to server" });
    } finally {
      setRunning(false);
    }
  }, []);

  const handleRun = useCallback(() => executeQuery(sqlText), [sqlText, executeQuery]);

  const handleClear = useCallback(() => {
    setStats(null);
    setResult(null);
    setSqlText("SELECT * FROM tablename LIMIT 10");
    setUploadError(null);
    setUploadProgress(null);
  }, []);

  const handleCopyToEditor = useCallback((sql: string) => {
    setSqlText(sql);
  }, []);

  const handleRunFromChat = useCallback((sql: string) => {
    setSqlText(sql);
    executeQuery(sql);
  }, [executeQuery]);

  const downloadCSV = useCallback(() => {
    if (!result || !result.columns.length) return;
    const escape = (val: string | number | null): string => {
      if (val === null) return "";
      const s = String(val);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const header = result.columns.map(escape).join(",");
    const body = result.rows.map((row) => row.map(escape).join(",")).join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "query_results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const suggestions = useMemo(() => {
    if (!stats || stats.columnCount === 0) return [];
    const queries: { label: string; sql: string }[] = [];

    queries.push({ label: "Preview", sql: "SELECT * FROM tablename LIMIT 10" });

    const numCol = stats.columns.find((c) => c.type === "INTEGER" || c.type === "REAL");
    if (numCol) {
      queries.push({
        label: `Stats: ${numCol.name}`,
        sql: `SELECT ROUND(AVG("${numCol.name}"), 2) AS avg_val, MIN("${numCol.name}") AS min_val, MAX("${numCol.name}") AS max_val FROM tablename`,
      });
    }

    const textCol = stats.columns.find((c) => c.type === "TEXT");
    if (textCol) {
      queries.push({
        label: `Group: ${textCol.name}`,
        sql: `SELECT "${textCol.name}", COUNT(*) AS count FROM tablename GROUP BY "${textCol.name}" ORDER BY count DESC LIMIT 20`,
      });
    }

    queries.push({ label: "Row count", sql: "SELECT COUNT(*) AS total_rows FROM tablename" });

    return queries.slice(0, 4);
  }, [stats]);

  const runE2ETest = useCallback(async () => {
    const hasData = stats !== null && stats.columnCount > 0;
    const steps: TestStep[] = [
      { name: hasData ? "Check existing CSV" : "Upload test CSV", status: "pending" },
      { name: "Fetch stats", status: "pending" },
      { name: "Run COUNT query", status: "pending" },
      { name: "Run SELECT query", status: "pending" },
    ];
    setTestSteps([...steps]);
    setTestRunning(true);

    const update = (i: number, status: TestStep["status"], detail?: string) => {
      steps[i] = { ...steps[i], status, detail };
      setTestSteps([...steps]);
    };

    // Step 1: Ensure data is loaded
    update(0, "running");
    if (hasData) {
      update(0, "pass", `Already loaded: ${stats.rowCount} rows, ${stats.columnCount} cols`);
    } else {
      try {
        const csv = "id,name,score\n1,alice,85.5\n2,bob,92.0\n3,charlie,78.3\n";
        const blob = new Blob([csv], { type: "text/csv" });
        const file = new File([blob], "e2e_test.csv", { type: "text/csv" });
        const uploadRes = await uploadCSV(file);
        if (uploadRes.rowCount > 0 && uploadRes.columnCount > 0) {
          update(0, "pass", `Uploaded ${uploadRes.rowCount} rows, ${uploadRes.columnCount} cols`);
        } else {
          update(0, "fail", "Upload returned 0 rows or columns");
          setTestRunning(false);
          return;
        }
      } catch (err) {
        update(0, "fail", err instanceof Error ? err.message : "Unknown error");
        setTestRunning(false);
        return;
      }
    }

    // Step 2: Fetch stats
    update(1, "running");
    let statsRes: StatsResponse;
    try {
      statsRes = await fetchStats();
      if (statsRes.columns && statsRes.columns.length > 0) {
        update(1, "pass", `${statsRes.rowCount} rows, ${statsRes.columns.length} columns`);
        setStats(statsRes);
      } else {
        update(1, "fail", "Stats returned no columns");
        setTestRunning(false);
        return;
      }
    } catch (err) {
      update(1, "fail", err instanceof Error ? err.message : "Unknown error");
      setTestRunning(false);
      return;
    }

    // Step 3: Run COUNT(*) — works on any table
    update(2, "running");
    try {
      const countRes = await runQuery("SELECT COUNT(*) AS total FROM tablename");
      if (countRes.error) {
        update(2, "fail", countRes.error);
        setTestRunning(false);
        return;
      }
      const total = countRes.rows[0]?.[0];
      update(2, "pass", `COUNT(*) = ${total}`);
    } catch (err) {
      update(2, "fail", err instanceof Error ? err.message : "Unknown error");
      setTestRunning(false);
      return;
    }

    // Step 4: Run SELECT * LIMIT 5 — works on any table, verify data renders
    update(3, "running");
    try {
      const selectRes = await runQuery("SELECT * FROM tablename LIMIT 5");
      if (selectRes.error) {
        update(3, "fail", selectRes.error);
        setTestRunning(false);
        return;
      }
      if (selectRes.columns.length > 0 && selectRes.rows.length > 0) {
        update(3, "pass", `${selectRes.rows.length} rows, ${selectRes.columns.length} cols returned`);
        setResult(selectRes);
        setSqlText("SELECT * FROM tablename LIMIT 5");
      } else {
        update(3, "fail", "Query returned no data");
        setTestRunning(false);
        return;
      }
    } catch (err) {
      update(3, "fail", err instanceof Error ? err.message : "Unknown error");
      setTestRunning(false);
      return;
    }

    setTestRunning(false);
  }, [stats]);

  const loaded = stats !== null && stats.columnCount > 0;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200 bg-white px-6 py-3 flex items-center gap-3">
        <h1 className="text-lg font-semibold text-gray-800">ArtemisGO</h1>
        <span className="text-xs text-gray-400">CSV &rarr; SQL</span>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={runE2ETest}
            disabled={testRunning}
            className="text-xs text-green-600 hover:text-green-700 cursor-pointer px-2 py-1 rounded hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testRunning ? "Running..." : "E2E Test"}
          </button>
          {loaded && (
            <>
              <label className="text-xs text-blue-600 hover:text-blue-700 cursor-pointer">
                Upload new CSV
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                onClick={handleClear}
                className="text-xs text-red-600 hover:text-red-700 cursor-pointer px-2 py-1 rounded hover:bg-red-50 transition-colors"
              >
                Clear CSV
              </button>
            </>
          )}
        </div>
      </header>

      {/* E2E Test Results Overlay */}
      {testSteps && (
        <div className="absolute top-14 right-6 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-80">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">E2E Test Results</h3>
            <button
              onClick={() => setTestSteps(null)}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              &times;
            </button>
          </div>
          <div className="space-y-2">
            {testSteps.map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-0.5 text-sm">
                  {step.status === "pass" && <span className="text-green-500">PASS</span>}
                  {step.status === "fail" && <span className="text-red-500">FAIL</span>}
                  {step.status === "running" && <span className="text-blue-500">...</span>}
                  {step.status === "pending" && <span className="text-gray-300">--</span>}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{step.name}</p>
                  {step.detail && (
                    <p className="text-xs text-gray-400 truncate">{step.detail}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {!testRunning && testSteps.every(s => s.status === "pass") && (
            <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-green-600 font-medium">
              All steps passed
            </div>
          )}
          {!testRunning && testSteps.some(s => s.status === "fail") && (
            <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-red-600 font-medium">
              Test failed
            </div>
          )}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Main area */}
        <main className="flex-1 p-6 overflow-auto flex flex-col gap-4">
          {!loaded ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-full max-w-lg">
                <UploadZone onUpload={handleUpload} uploadProgress={uploading ? uploadProgress : null} />
                {uploadError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {uploadError}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <SqlEditor
                value={sqlText}
                onChange={setSqlText}
                onRun={handleRun}
              />
              {suggestions.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 -mt-2">
                  <span className="text-xs text-gray-400">Try:</span>
                  {suggestions.map((s) => (
                    <button
                      key={s.sql}
                      onClick={() => { setSqlText(s.sql); executeQuery(s.sql); }}
                      className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full hover:bg-blue-100 transition-colors"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
              {result && result.columns.length > 0 && !result.error && (
                <div className="flex items-center gap-3 -mt-2">
                  <button
                    onClick={downloadCSV}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-xs font-medium border border-gray-200"
                  >
                    Export CSV
                  </button>
                </div>
              )}
              {running ? (
                <div className="text-sm text-gray-400">Running query...</div>
              ) : result ? (
                <ResultsTable
                  columns={result.columns}
                  rows={result.rows}
                  error={result.error}
                  totalRows={stats?.rowCount}
                />
              ) : (
                <div className="text-sm text-gray-400">
                  Write a SQL query and hit Run
                </div>
              )}
            </>
          )}
        </main>

        {/* Stats sidebar */}
        <aside className="w-64 border-l border-gray-200 bg-white p-4 overflow-auto shrink-0">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Data Stats
          </h2>
          <StatsSidebar stats={stats} />
        </aside>
      </div>

      <ChatPanel
        isDataLoaded={loaded}
        onCopyToEditor={handleCopyToEditor}
        onRunQuery={handleRunFromChat}
      />
    </div>
  );
}
