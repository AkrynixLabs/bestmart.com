// CSV that opens safely in Excel / Google Sheets: quoted where needed, and
// cells starting with = + - @ are prefixed so they can't run as formulas.

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ""
  let s = String(value)
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n"
}

/** Pesewas to "1234.50" (no symbol, so spreadsheets read it as a number). */
export const cedis = (pesewas: number) => (pesewas / 100).toFixed(2)
