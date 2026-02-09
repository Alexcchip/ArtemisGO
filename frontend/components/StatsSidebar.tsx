"use client";

import { useState } from "react";
import {
  StatsResponse,
  ColumnInfo,
  NumericStats,
  TextStats,
  HistogramBucket,
  ValueCount,
} from "@/lib/api";

interface StatsSidebarProps {
  stats: StatsResponse | null;
}

function isNumeric(col: ColumnInfo): boolean {
  return col.type === "INTEGER" || col.type === "REAL";
}

function Bar({ ratio, label, count }: { ratio: number; label: string; count: number }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] leading-tight">
      <span className="w-16 text-right text-gray-500 truncate shrink-0" title={label}>
        {label}
      </span>
      <div className="flex-1 bg-gray-100 rounded h-3.5 overflow-hidden">
        <div
          className="bg-blue-400 h-full rounded transition-all"
          style={{ width: `${Math.max(ratio * 100, 1)}%` }}
        />
      </div>
      <span className="w-10 text-right text-gray-400 shrink-0">{count}</span>
    </div>
  );
}

function NumericDetail({ col }: { col: ColumnInfo }) {
  const s = col.stats as NumericStats | undefined;
  const dist = (col.distribution ?? []) as HistogramBucket[];

  if (!s) return null;

  const maxCount = Math.max(...dist.map((b) => b.count), 1);

  return (
    <div className="space-y-2 mt-2">
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
        <span className="text-gray-500">Min</span>
        <span className="text-gray-700 text-right font-mono">{s.min ?? "—"}</span>
        <span className="text-gray-500">Max</span>
        <span className="text-gray-700 text-right font-mono">{s.max ?? "—"}</span>
        <span className="text-gray-500">Mean</span>
        <span className="text-gray-700 text-right font-mono">{s.mean ?? "—"}</span>
        <span className="text-gray-500">Nulls</span>
        <span className="text-gray-700 text-right font-mono">{s.nullCount}</span>
      </div>
      {dist.length > 0 && (
        <div className="space-y-0.5">
          {dist.map((b, i) => (
            <Bar
              key={i}
              ratio={b.count / maxCount}
              label={`${b.bucketMin}`}
              count={b.count}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TextDetail({ col }: { col: ColumnInfo }) {
  const s = col.stats as TextStats | undefined;
  const dist = (col.distribution ?? []) as ValueCount[];

  if (!s) return null;

  const maxCount = Math.max(...dist.map((v) => v.count), 1);

  return (
    <div className="space-y-2 mt-2">
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
        <span className="text-gray-500">Unique</span>
        <span className="text-gray-700 text-right font-mono">{s.uniqueCount}</span>
        <span className="text-gray-500">Nulls</span>
        <span className="text-gray-700 text-right font-mono">{s.nullCount}</span>
      </div>
      {dist.length > 0 && (
        <div className="space-y-0.5">
          {dist.map((v, i) => (
            <Bar
              key={i}
              ratio={v.count / maxCount}
              label={v.value}
              count={v.count}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function StatsSidebar({ stats }: StatsSidebarProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (!stats || stats.columnCount === 0) {
    return (
      <div className="text-sm text-gray-400 text-center py-8">
        Upload a CSV to see stats
      </div>
    );
  }

  const toggle = (name: string) =>
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));

  return (
    <div className="space-y-4">
      <div className="flex gap-6">
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Rows
          </div>
          <div className="text-2xl font-semibold text-gray-800">
            {stats.rowCount.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Columns
          </div>
          <div className="text-2xl font-semibold text-gray-800">
            {stats.columnCount}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        {stats.columns.map((col) => {
          const open = !!expanded[col.name];
          return (
            <div key={col.name} className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggle(col.name)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <span className="text-sm text-gray-700 font-mono truncate mr-2">
                  {col.name}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono">
                    {col.type}
                  </span>
                  <svg
                    className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              {open && (
                <div className="px-2.5 pb-2.5 border-t border-gray-100">
                  {isNumeric(col) ? (
                    <NumericDetail col={col} />
                  ) : (
                    <TextDetail col={col} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
