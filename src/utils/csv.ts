// Small helpers for exporting chart buffers to CSV and triggering a download.

// Build a CSV string from a shared time column plus one column per labelled
// series. Rows are aligned to the shortest column so ragged buffers stay valid.
export function seriesToCsv(
  time: number[],
  labels: string[],
  cols: number[][],
): string {
  const n = cols.length ? Math.min(time.length, ...cols.map((c) => c.length)) : time.length;
  const header = ["time", ...labels].join(",");
  const lines = [header];
  for (let i = 0; i < n; i++) {
    lines.push([time[i], ...cols.map((c) => c[i])].join(","));
  }
  return lines.join("\n");
}

// Copy text to the clipboard (best-effort; resolves false if unavailable).
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Trigger a browser download of a text blob.
export function downloadText(
  filename: string,
  text: string,
  mime = "text/csv;charset=utf-8",
) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
