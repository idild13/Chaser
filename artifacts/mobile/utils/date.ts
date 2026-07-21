// Shared date display/parsing helpers.
//
// Storage format stays ISO (YYYY-MM-DD for due dates, full ISO timestamps for
// createdAt/paidAt) so sorting and comparisons keep working. Display format is
// DD/MM/YYYY everywhere (EU convention).

/**
 * Format a stored date (YYYY-MM-DD or full ISO timestamp) as DD/MM/YYYY.
 * Date-only strings are rearranged textually to avoid timezone shifts.
 * Unparseable input is returned unchanged.
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return dateStr;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/**
 * Parse a DD/MM/YYYY user entry into the stored YYYY-MM-DD format.
 * Returns null when the input is not a valid calendar date.
 */
export function parseDisplayDate(input: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
