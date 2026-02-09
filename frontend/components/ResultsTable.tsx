"use client";

interface ResultsTableProps {
  columns: string[];
  rows: (string | number | null)[][];
  error?: string;
  totalRows?: number;
}

function formatCell(cell: string | number | null): React.ReactNode {
  if (cell === null) {
    return <span className="text-gray-300 italic">NULL</span>;
  }
  if (typeof cell === "number") {
    return Number.isInteger(cell)
      ? cell.toLocaleString()
      : cell.toLocaleString(undefined, { maximumFractionDigits: 3 });
  }
  return String(cell);
}

export default function ResultsTable({
  columns,
  rows,
  error,
  totalRows,
}: ResultsTableProps) {
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        <span className="font-medium">Error: </span>
        {error}
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="p-4 text-gray-400 text-sm text-center">
        Run a query to see results
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-auto max-h-[400px]">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="px-4 py-2 text-left font-medium text-gray-700 border-b border-gray-200 whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="px-4 py-2 border-b border-gray-100 whitespace-nowrap text-gray-600"
                >
                  {formatCell(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="p-4 text-center text-gray-400 text-sm">
          Query returned no rows
        </div>
      )}
      {columns.length > 0 && rows.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
          {totalRows && totalRows > rows.length
            ? `Showing ${rows.length.toLocaleString()} of ${totalRows.toLocaleString()} rows`
            : `${rows.length.toLocaleString()} row${rows.length !== 1 ? "s" : ""} returned`}
        </div>
      )}
    </div>
  );
}
