export type CurrencyCode = "USD" | "EUR" | "GBP" | "CHF" | "AUD" | "CAD";

// "comma-dot" => 1,000.00   "dot-comma" => 1.000,00
export type NumberFormat = "comma-dot" | "dot-comma";

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  label: string;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "CHF", symbol: "CHF", label: "Swiss Franc" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar" },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar" },
];

export function isCurrencyCode(code: unknown): code is CurrencyCode {
  return typeof code === "string" && CURRENCIES.some((c) => c.code === code);
}

export function currencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}

export function formatMoney(
  amount: number,
  code: string = "EUR",
  numberFormat: NumberFormat = "comma-dot"
): string {
  const symbol = currencySymbol(code);
  const n = isFinite(amount) ? amount : 0;
  const fixed = Math.abs(n).toFixed(2);
  const [intPart, decPart] = fixed.split(".");

  const groupSep = numberFormat === "comma-dot" ? "," : ".";
  const decSep = numberFormat === "comma-dot" ? "." : ",";

  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, groupSep);
  const sign = n < 0 ? "-" : "";
  // Multi-char symbols (e.g. CHF) read better with a space.
  const sep = symbol.length > 1 ? "\u00A0" : "";
  return `${sign}${symbol}${sep}${grouped}${decSep}${decPart}`;
}
