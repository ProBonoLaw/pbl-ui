import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Drag & Drop File Uploader (no deps)
 * - Click or drag files
 * - Multiple files, type/size validation
 * - Optional upload with progress via XMLHttpRequest
 *
 * Props:
 *  - action?: string        // POST URL to upload to (if omitted, no network request is made)
 *  - fieldName?: string     // multipart field name (default: "file")
 *  - accept?: string        // e.g. "image/*,.pdf"
 *  - multiple?: boolean     // allow multiple selection (default: true)
 *  - maxSizeBytes?: number  // per-file limit
 *  - headers?: Record<string,string>
 *  - onComplete?: (results) => void  // per-batch results
 */

function matchesAccept(file: File, accept?: string) {
  if (!accept) return true;
  const rules = accept.split(',').map((s) => s.trim().toLowerCase());
  const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
  const type = (file.type || '').toLowerCase();
  return rules.some((rule) => {
    if (rule === '*/*') return true;
    if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
    if (rule.startsWith('.')) return rule === ext;
    return rule === type;
  });
}

function uploadFileXHR(
  url: string,
  file: File,
  fieldName: string,
  headers?: Record<string, string>,
  onProgress?: (pct: number) => void,
) {
  return new Promise<{
    ok: boolean;
    status: number;
    response?: unknown;
    error?: unknown;
  }>((resolve) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append(fieldName, file, file.name);

    xhr.open('PUT', url, true);
    if (headers)
      Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        const ok = xhr.status >= 200 && xhr.status < 300;
        let payload: unknown = undefined;
        try {
          payload = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
        } catch {
          payload = xhr.responseText;
        }
        resolve({
          ok,
          status: xhr.status,
          response: payload,
          error: ok ? undefined : xhr.responseText,
        });
      }
    };

    xhr.onerror = () =>
      resolve({ ok: false, status: 0, error: 'Network error' });

    xhr.send(form);
  });
}

export function FileDropUpload({
  action,
  fieldName = 'file',
  accept,
  multiple = true,
  maxSizeBytes,
  headers,
  onComplete,
}: {
  action?: string;
  fieldName?: string;
  accept?: string;
  multiple?: boolean;
  maxSizeBytes?: number;
  headers?: Record<string, string>;
  onComplete?: (
    results: Array<{
      file: File;
      ok: boolean;
      status: number;
      response?: unknown;
      error?: unknown;
    }>,
  ) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dismissTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );
  const [dragOver, setDragOver] = useState(false);
  const [items, setItems] = useState<
    Array<{
      id: string;
      file: File;
      progress: number;
      status: 'queued' | 'uploading' | 'done' | 'error';
      msg?: string;
    }>
  >([]);

  const dismissItem = useCallback((id: string) => {
    const dismissTimer = dismissTimers.current[id];
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      delete dismissTimers.current[id];
    }
    setItems((currentItems) => currentItems.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    const timers = dismissTimers.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  const validate = (f: File) => {
    if (maxSizeBytes && f.size > maxSizeBytes)
      return `Too large: ${(f.size / 1_000_000).toFixed(2)} MB`;
    if (!matchesAccept(f, accept)) return 'Type not allowed';
    return null;
  };

  const handleSelected = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    const queued = arr.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file,
      progress: 0,
      status: 'queued' as const,
    }));

    // apply validation
    const withStatus = queued.map((it) => {
      const err = validate(it.file);
      return err ? { ...it, status: 'error' as const, msg: err } : it;
    });

    setItems((prev) => [...withStatus, ...prev]);

    // If action provided, upload valid ones
    if (action) {
      const valid = withStatus.filter((i) => i.status === 'queued');
      const results: Array<{
        file: File;
        ok: boolean;
        status: number;
        response?: unknown;
        error?: unknown;
      }> = [];

      for (const it of valid) {
        setItems((prev) =>
          prev.map((p) => (p.id === it.id ? { ...p, status: 'uploading' } : p)),
        );
        const res = await uploadFileXHR(
          action,
          it.file,
          fieldName,
          headers,
          (pct) =>
            setItems((prev) =>
              prev.map((p) => (p.id === it.id ? { ...p, progress: pct } : p)),
            ),
        );
        setItems((prev) =>
          prev.map((p) =>
            p.id === it.id
              ? {
                  ...p,
                  status: res.ok ? 'done' : 'error',
                  msg: res.ok ? undefined : `HTTP ${res.status}`,
                }
              : p,
          ),
        );
        if (res.ok) {
          dismissTimers.current[it.id] = setTimeout(
            () => dismissItem(it.id),
            30_000,
          );
        }
        results.push({ file: it.file, ...res });
      }

      onComplete?.(results);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files?.length) handleSelected(e.dataTransfer.files);
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload files"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) =>
          (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()
        }
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-2xl p-2 md:p-8 text-center cursor-pointer transition outline-none select-none ${
          dragOver
            ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-500/10'
            : 'border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800/60'
        }`}>
        <p className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">
          Drag & drop files here
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-300">
          or click to browse
        </p>
        {accept && (
          <p className="mt-1 max-w-full break-all text-xs text-gray-500 dark:text-gray-300">
            Accepted: {accept}
          </p>
        )}
        {maxSizeBytes && (
          <p className="text-xs text-gray-500 dark:text-gray-300">
            Max size: {(maxSizeBytes / 1_000_000).toFixed(1)} MB each
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple={multiple}
          onChange={(e) => e.target.files && handleSelected(e.target.files)}
        />
      </div>

      {!!items.length && (
        <ul className="mt-4 space-y-3">
          {items.map((it) => (
            <li key={it.id} className="relative border rounded-xl p-3">
              {it.status === 'done' && (
                <button
                  type="button"
                  aria-label={`Dismiss ${it.file.name} upload notification`}
                  className="absolute right-3 top-3 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                  onClick={() => dismissItem(it.id)}>
                  <span aria-hidden="true">×</span>
                </button>
              )}
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{it.file.name}</div>
                  <div className="text-xs text-gray-500">
                    {(it.file.size / 1_000_000).toFixed(2)} MB
                  </div>
                </div>
                {action && (
                  <div className="mr-7 text-xs text-gray-600">
                    {it.status === 'uploading' && `${it.progress}%`}
                    {it.status === 'done' && 'Done'}
                    {it.status === 'error' && (it.msg || 'Error')}
                  </div>
                )}
              </div>
              {action && (
                <div className="mt-2 h-2 bg-gray-200 rounded">
                  <div
                    className={`h-2 rounded ${it.status === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}
                    style={{ width: `${it.progress}%` }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
