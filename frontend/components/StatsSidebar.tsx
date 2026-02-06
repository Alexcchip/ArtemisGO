"use client";

import { StatsResponse } from "@/lib/api";

interface StatsSidebarProps {
  stats: StatsResponse | null;
}

export default function StatsSidebar({ stats }: StatsSidebarProps) {
  if (!stats || stats.columnCount === 0) {
    return (
      <div className="text-sm text-gray-400 text-center py-8">
        Upload a CSV to see stats
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
      <div>
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Schema
        </div>
        <div className="space-y-1">
          {stats.columns.map((col) => (
            <div
              key={col.name}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-gray-700 font-mono truncate mr-2">
                {col.name}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500 font-mono shrink-0">
                {col.type}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
