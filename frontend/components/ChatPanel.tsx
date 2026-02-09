"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { sendChatMessage, ChatMessage, ChatResponse } from "@/lib/api";

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  sql?: string;
  queryResult?: { columns: string[]; rows: (string | number | null)[][] };
}

interface ChatPanelProps {
  isDataLoaded: boolean;
  onCopyToEditor: (sql: string) => void;
  onRunQuery: (sql: string) => void;
}

const SUGGESTIONS = [
  "Show first 10 rows",
  "What columns are in this table?",
  "How many rows are there?",
  "Summarize the numeric columns",
];

export default function ChatPanel({ isDataLoaded, onCopyToEditor, onRunQuery }: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: DisplayMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const history: ChatMessage[] = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: text },
      ];

      const resp: ChatResponse = await sendChatMessage(history, true);

      const assistantMsg: DisplayMessage = {
        role: "assistant",
        content: resp.reply,
        sql: resp.sql,
        queryResult: resp.queryResult as DisplayMessage["queryResult"],
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: DisplayMessage = {
        role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}`,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // Strip SQL fences from displayed text to avoid duplication
  const stripSQLFences = (text: string) => {
    return text.replace(/```sql\s*\n?[\s\S]*?```/g, "").trim();
  };

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
        title="AI SQL Assistant"
      >
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[500px] bg-white border border-gray-200 rounded-xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 bg-blue-600 text-white rounded-t-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">AI SQL Assistant</h3>
                <p className="text-xs text-blue-100">Powered by Gemini</p>
              </div>
              <button
                onClick={() => setMessages([])}
                className="text-xs text-blue-200 hover:text-white transition-colors"
                title="Clear chat"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {!isDataLoaded && (
              <div className="text-center text-sm text-gray-400 mt-8">
                Upload a CSV file first to start chatting.
              </div>
            )}

            {isDataLoaded && messages.length === 0 && !isLoading && (
              <div className="space-y-3 mt-4">
                <p className="text-sm text-gray-500 text-center">Ask me anything about your data!</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-full border border-blue-200 hover:bg-blue-100 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="space-y-2">
                      {stripSQLFences(msg.content) && (
                        <p className="whitespace-pre-wrap">{stripSQLFences(msg.content)}</p>
                      )}
                      {msg.sql && (
                        <div className="bg-gray-800 text-green-300 rounded p-2 text-xs font-mono overflow-x-auto">
                          <pre className="whitespace-pre-wrap">{msg.sql}</pre>
                          <div className="flex gap-2 mt-2 pt-2 border-t border-gray-600">
                            <button
                              onClick={() => onCopyToEditor(msg.sql!)}
                              className="text-xs text-blue-300 hover:text-blue-200 transition-colors"
                            >
                              Copy to Editor
                            </button>
                            <button
                              onClick={() => onRunQuery(msg.sql!)}
                              className="text-xs text-yellow-300 hover:text-yellow-200 transition-colors"
                            >
                              Run Query
                            </button>
                          </div>
                        </div>
                      )}
                      {msg.queryResult && msg.queryResult.rows.length > 0 && (
                        <div className="bg-white border border-gray-200 rounded overflow-hidden mt-1">
                          <div className="text-xs text-gray-500 px-2 py-1 bg-gray-50 border-b border-gray-200">
                            Results ({msg.queryResult.rows.length} rows)
                          </div>
                          <div className="overflow-x-auto max-h-32">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-gray-50">
                                  {msg.queryResult.columns.map((col) => (
                                    <th key={col} className="px-2 py-1 text-left text-gray-600 font-medium whitespace-nowrap">
                                      {col}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {msg.queryResult.rows.slice(0, 5).map((row, ri) => (
                                  <tr key={ri} className="border-t border-gray-100">
                                    {row.map((cell, ci) => (
                                      <td key={ci} className="px-2 py-1 whitespace-nowrap text-gray-700">
                                        {cell === null ? <span className="text-gray-300">NULL</span> : String(cell)}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {msg.queryResult.rows.length > 5 && (
                            <div className="text-xs text-gray-400 px-2 py-1 bg-gray-50 border-t border-gray-200">
                              +{msg.queryResult.rows.length - 5} more rows
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-chat-dot" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-chat-dot" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-chat-dot" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="border-t border-gray-200 p-3 flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isDataLoaded ? "Ask about your data..." : "Upload a CSV first"}
              disabled={!isDataLoaded || isLoading}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 disabled:bg-gray-50 disabled:text-gray-400"
            />
            <button
              type="submit"
              disabled={!isDataLoaded || !input.trim() || isLoading}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
