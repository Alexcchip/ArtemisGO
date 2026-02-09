"use client";

import { useCallback, useMemo, useRef, useEffect } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { keymap, EditorView } from "@codemirror/view";

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
}

export default function SqlEditor({ value, onChange, onRun }: SqlEditorProps) {
  const onRunRef = useRef(onRun);
  useEffect(() => {
    onRunRef.current = onRun;
  }, [onRun]);

  const handleChange = useCallback(
    (val: string) => {
      onChange(val);
    },
    [onChange]
  );

  const runKeymap = useMemo(() => {
    return keymap.of([
      {
        key: "Mod-Enter",
        run: () => {
          onRunRef.current();
          return true;
        },
      },
    ]);
  }, []);

  const customTheme = useMemo(() => EditorView.theme({
    "&": {
      fontSize: "14px",
      backgroundColor: "#ffffff",
    },
    ".cm-content": {
      padding: "8px",
      minHeight: "160px",
    },
    ".cm-scroller": {
      fontFamily: "monospace",
    },
    ".cm-focused": {
      outline: "none",
    },
  }), []);

  return (
    <div className="flex flex-col gap-2">
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <CodeMirror
          value={value}
          height="160px"
          extensions={[sql(), runKeymap, customTheme]}
          onChange={handleChange}
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
