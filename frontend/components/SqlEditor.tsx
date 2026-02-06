"use client";

import { useCallback } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { keymap } from "@codemirror/view";

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
}

export default function SqlEditor({ value, onChange, onRun }: SqlEditorProps) {
  const runKeymap = keymap.of([
    {
      key: "Mod-Enter",
      run: () => {
        onRun();
        return true;
      },
    },
  ]);

  const handleChange = useCallback(
    (val: string) => {
      onChange(val);
    },
    [onChange]
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <CodeMirror
          value={value}
          height="160px"
          extensions={[sql(), runKeymap]}
          onChange={handleChange}
          theme="light"
          placeholder="SELECT * FROM tablename LIMIT 10"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onRun}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
        >
          Run Query
        </button>
        <span className="text-xs text-gray-400">Ctrl/Cmd + Enter</span>
      </div>
    </div>
  );
}
