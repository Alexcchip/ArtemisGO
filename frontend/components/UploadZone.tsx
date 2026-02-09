"use client";

import { useCallback, useState } from "react";

interface UploadZoneProps {
  onUpload: (file: File) => void;
  uploadProgress?: number | null;
}

export default function UploadZone({ onUpload, uploadProgress }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onUpload(file);
    },
    [onUpload]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onUpload(file);
      e.target.value = "";
    },
    [onUpload]
  );

  if (uploadProgress != null) {
    const processing = uploadProgress >= 100;
    return (
      <div className="flex flex-col items-center justify-center border-2 border-blue-300 rounded-xl p-16 bg-blue-50">
        <p className="text-lg font-medium text-gray-700 mb-4">
          {processing ? "Processing CSV..." : "Uploading..."}
        </p>
        <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
          <div
            className={`h-3 rounded-full transition-all duration-200 ${processing ? "bg-green-500 animate-pulse" : "bg-blue-500"}`}
            style={{ width: "100%" }}
          />
        </div>
        <p className="text-sm text-gray-600">
          {processing ? "Inserting rows into database..." : `${uploadProgress}%`}
        </p>
      </div>
    );
  }

  return (
    <label
      htmlFor="csv-upload"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-16 transition-colors cursor-pointer ${
        dragging
          ? "border-blue-500 bg-blue-50"
          : "border-gray-300 hover:border-gray-400"
      }`}
    >
      <svg
        className="w-12 h-12 text-gray-400 mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        />
      </svg>
      <p className="text-lg font-medium text-gray-700 mb-1">
        Drop a CSV file here
      </p>
      <p className="text-sm text-gray-500 mb-4">or click to browse</p>
      <input
        type="file"
        accept=".csv"
        onChange={handleChange}
        className="hidden"
        id="csv-upload"
      />
      <span className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer text-sm font-medium">
        Choose File
      </span>
    </label>
  );
}
