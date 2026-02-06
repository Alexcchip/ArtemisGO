export interface ColumnInfo {
  name: string;
  type: string;
}

export interface StatsResponse {
  rowCount: number;
  columnCount: number;
  columns: ColumnInfo[];
}

export interface QueryResponse {
  columns: string[];
  rows: (string | number | null)[][];
  error?: string;
}

export async function uploadCSV(file: File): Promise<StatsResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data;
}

export async function runQuery(sql: string): Promise<QueryResponse> {
  const res = await fetch("/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql }),
  });
  return res.json();
}

export async function fetchStats(): Promise<StatsResponse> {
  const res = await fetch("/api/stats");
  return res.json();
}
