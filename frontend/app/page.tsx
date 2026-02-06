"use client";

import { useState, useCallback } from "react";
import UploadZone from "@/components/UploadZone";
import SqlEditor from "@/components/SqlEditor";
import ResultsTable from "@/components/ResultsTable";
import StatsSidebar from "@/components/StatsSidebar";
import { uploadCSV, runQuery, StatsResponse, QueryResponse } from "@/lib/api";

export default function Home() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [sqlText, setSqlText] = useState("SELECT * FROM tablename LIMIT 10");
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [running, setRunning] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const data = await uploadCSV(file);
      setStats(data);
      setResult(null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const handleRun = useCallback(async () => {
    if (!sqlText.trim()) return;
    setRunning(true);
    try {
      const data = await runQuery(sqlText);
      setResult(data);
    } catch {
      setResult({ columns: [], rows: [], error: "Failed to connect to server" });
    } finally {
      setRunning(false);
    }
  }, [sqlText]);

  const loaded = stats !== null && stats.columnCount > 0;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200 bg-white px-6 py-3 flex items-center gap-3">
        <h1 className="text-lg font-semibold text-gray-800">ArtemisGO</h1>
        <span className="text-xs text-gray-400">CSV &rarr; SQL</span>
        {loaded && (
          <label className="ml-auto text-xs text-blue-600 hover:text-blue-700 cursor-pointer">
            Upload new CSV
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
          </label>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main area */}
        <main className="flex-1 p-6 overflow-auto flex flex-col gap-4">
          {!loaded ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-full max-w-lg">
                {uploading ? (
                  <div className="text-center text-gray-500">Uploading...</div>
                ) : (
                  <UploadZone onUpload={handleUpload} />
                )}
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
              {running ? (
                <div className="text-sm text-gray-400">Running query...</div>
              ) : result ? (
                <ResultsTable
                  columns={result.columns}
                  rows={result.rows}
                  error={result.error}
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
    </div>
  );
}
