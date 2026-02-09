export interface HistogramBucket {
  bucketMin: number;
  bucketMax: number;
  count: number;
}

export interface ValueCount {
  value: string;
  count: number;
}

export interface NumericStats {
  min: number | null;
  max: number | null;
  mean: number | null;
  nullCount: number;
}

export interface TextStats {
  uniqueCount: number;
  nullCount: number;
  topValues: ValueCount[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  stats?: NumericStats | TextStats;
  distribution?: HistogramBucket[] | ValueCount[];
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

export async function uploadCSV(
  file: File,
  onProgress?: (pct: number) => void
): Promise<StatsResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          reject(new Error(data.error || `Upload failed with status ${xhr.status}`));
        }
      } catch {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Upload failed: network error"));
    };

    // Upload directly to Go backend — the Next.js proxy buffers the
    // entire body in memory and drops the connection on large files.
    xhr.open("POST", `${API}/api/upload`);
    xhr.send(form);
  });
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export async function runQuery(sql: string): Promise<QueryResponse> {
  const res = await fetch(`${API}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql }),
  });
  return res.json();
}

export async function fetchStats(): Promise<StatsResponse> {
  const res = await fetch(`${API}/api/stats`);
  return res.json();
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  sql?: string;
  queryResult?: {
    columns: string[];
    rows: (string | number | null)[][];
  };
  error?: string;
}

export async function sendChatMessage(
  messages: ChatMessage[],
  autoExecute: boolean
): Promise<ChatResponse> {
  const res = await fetch(`${API}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, autoExecute }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Chat request failed" }));
    throw new Error(data.error || `Chat request failed with status ${res.status}`);
  }
  return res.json();
}
