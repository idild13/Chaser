import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { CurrencyCode, isCurrencyCode } from "@/utils/currency";

export type InvoiceStatus = "pending" | "paid" | "overdue";
export type DiscountType = "percent" | "fixed";

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  client: string;
  clientEmail?: string;
  clientAddress?: string;
  invnum: string;
  poNumber?: string;
  lineItems: LineItem[];
  currency: CurrencyCode;
  taxRate: number; // percent
  discountType?: DiscountType;
  discountValue?: number; // percent or fixed amount (in invoice currency)
  paymentTerms?: string;
  paymentNotes?: string;
  payLink?: string;
  due: string; // YYYY-MM-DD
  status: InvoiceStatus; // stored intent; use getEffectiveStatus for display
  amountPaid?: number;
  createdAt: string;
  // legacy fields kept optional for back-compat only (not a source of truth)
  desc?: string;
  amount?: number;
}

export type InvoiceDraft = Omit<Invoice, "id" | "createdAt">;

export interface InvoiceTotals {
  subtotal: number;
  discount: number;
  taxableBase: number;
  tax: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
}

export interface ClientSummary {
  name: string;
  email?: string;
  invoiceCount: number;
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
  currency: CurrencyCode;
}

export interface Metrics {
  currency: CurrencyCode;
  totalEarned: number; // collected (sum of amountPaid)
  pending: number; // outstanding balance, pending bucket
  pendingCount: number;
  overdue: number; // outstanding balance, overdue bucket
  overdueCount: number;
  avgDays: number | null;
}

interface InvoicesContextType {
  invoices: Invoice[];
  isLoading: boolean;
  addInvoice: (data: InvoiceDraft) => void;
  markPaid: (id: string) => void;
  recordPayment: (id: string, amount: number) => void;
  updateInvoice: (id: string, patch: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  metrics: Metrics;
  clients: ClientSummary[];
  nextInvNum: string;
  primaryCurrency: CurrencyCode;
}

const STORAGE_KEY = "fp_invoices";

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ---- Totals & status (canonical, used everywhere) -------------------------

export function computeInvoiceTotals(inv: Invoice): InvoiceTotals {
  const subtotal = round2(
    (inv.lineItems ?? []).reduce(
      (sum, li) =>
        sum + (Number(li.quantity) || 0) * (Number(li.unitPrice) || 0),
      0
    )
  );

  let discount = 0;
  if (inv.discountValue && inv.discountValue > 0) {
    discount =
      inv.discountType === "fixed"
        ? inv.discountValue
        : (subtotal * inv.discountValue) / 100;
  }
  discount = round2(Math.min(discount, subtotal));

  const taxableBase = round2(subtotal - discount);
  const tax = round2((taxableBase * (Number(inv.taxRate) || 0)) / 100);
  const total = round2(taxableBase + tax);
  const amountPaid = round2(Math.max(0, Number(inv.amountPaid) || 0));
  const balanceDue = round2(Math.max(0, total - amountPaid));

  return { subtotal, discount, taxableBase, tax, total, amountPaid, balanceDue };
}

export function isPastDue(due: string): boolean {
  if (!due) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${due}T00:00:00`);
  if (isNaN(d.getTime())) return false;
  return d.getTime() < today.getTime();
}

// Single source of truth for badges/buckets: paid only when nothing is owed.
export function getEffectiveStatus(inv: Invoice): InvoiceStatus {
  const { total, balanceDue } = computeInvoiceTotals(inv);
  if (total > 0 && balanceDue <= 0.005) return "paid";
  if (isPastDue(inv.due)) return "overdue";
  return "pending";
}

// ---- Migration ------------------------------------------------------------

function normalizeInvoice(raw: any): Invoice {
  const r = raw ?? {};
  const lineItems: LineItem[] =
    Array.isArray(r.lineItems) && r.lineItems.length > 0
      ? r.lineItems.map((li: any) => ({
          id: String(li?.id ?? genId()),
          description: String(li?.description ?? ""),
          quantity: Number(li?.quantity) || 0,
          unitPrice: Number(li?.unitPrice) || 0,
        }))
      : [
          {
            id: genId(),
            description: String(r.desc ?? "Services"),
            quantity: 1,
            unitPrice: Number(r.amount) || 0,
          },
        ];

  const status: InvoiceStatus =
    r.status === "paid" || r.status === "overdue" || r.status === "pending"
      ? r.status
      : "pending";

  const inv: Invoice = {
    id: String(r.id ?? genId()),
    client: String(r.client ?? ""),
    clientEmail: r.clientEmail ? String(r.clientEmail) : undefined,
    clientAddress: r.clientAddress ? String(r.clientAddress) : undefined,
    invnum: String(r.invnum ?? ""),
    poNumber: r.poNumber ? String(r.poNumber) : undefined,
    lineItems,
    currency: isCurrencyCode(r.currency) ? r.currency : "EUR",
    taxRate: Number(r.taxRate) || 0,
    discountType:
      r.discountType === "fixed"
        ? "fixed"
        : r.discountType === "percent"
        ? "percent"
        : undefined,
    discountValue:
      r.discountValue != null ? Number(r.discountValue) || 0 : undefined,
    paymentTerms: r.paymentTerms ? String(r.paymentTerms) : undefined,
    paymentNotes: r.paymentNotes ? String(r.paymentNotes) : undefined,
    payLink: r.payLink ? String(r.payLink) : undefined,
    due: String(r.due ?? ""),
    status,
    createdAt: String(r.createdAt ?? new Date().toISOString()),
  };

  if (r.amountPaid != null) {
    inv.amountPaid = round2(Number(r.amountPaid) || 0);
  } else {
    const { total } = computeInvoiceTotals(inv);
    inv.amountPaid = status === "paid" ? total : 0;
  }

  return inv;
}

// ---- Seed -----------------------------------------------------------------

const SEED_INVOICES: Invoice[] = [
  {
    id: "1",
    client: "Müller Design",
    invnum: "INV-001",
    lineItems: [
      {
        id: "li1",
        description: "Brand identity package",
        quantity: 1,
        unitPrice: 2400,
      },
    ],
    currency: "EUR",
    taxRate: 0,
    due: "2026-06-01",
    status: "paid",
    amountPaid: 2400,
    createdAt: "2026-05-01T00:00:00.000Z",
  },
  {
    id: "2",
    client: "TechStart GmbH",
    invnum: "INV-002",
    lineItems: [
      {
        id: "li2",
        description: "Landing page development",
        quantity: 1,
        unitPrice: 1800,
      },
    ],
    currency: "EUR",
    taxRate: 0,
    due: "2026-06-10",
    status: "overdue",
    amountPaid: 0,
    createdAt: "2026-05-10T00:00:00.000Z",
  },
  {
    id: "3",
    client: "Bright Agency",
    invnum: "INV-003",
    lineItems: [
      {
        id: "li3",
        description: "Social media graphics",
        quantity: 1,
        unitPrice: 950,
      },
    ],
    currency: "EUR",
    taxRate: 0,
    due: "2026-07-25",
    status: "pending",
    amountPaid: 0,
    createdAt: "2026-06-01T00:00:00.000Z",
  },
];

// ---- Aggregations ---------------------------------------------------------

function computePrimaryCurrency(invoices: Invoice[]): CurrencyCode {
  if (invoices.length === 0) return "EUR";
  const counts: Record<string, number> = {};
  invoices.forEach((i) => {
    counts[i.currency] = (counts[i.currency] || 0) + 1;
  });
  let best: CurrencyCode = "EUR";
  let bestN = -1;
  Object.entries(counts).forEach(([c, n]) => {
    if (n > bestN) {
      best = c as CurrencyCode;
      bestN = n;
    }
  });
  return best;
}

function computeMetrics(invoices: Invoice[], currency: CurrencyCode): Metrics {
  let totalEarned = 0;
  let pending = 0;
  let pendingCount = 0;
  let overdue = 0;
  let overdueCount = 0;
  let paidCount = 0;

  invoices
    .filter((i) => i.currency === currency)
    .forEach((inv) => {
      const t = computeInvoiceTotals(inv);
      totalEarned += t.amountPaid;
      const eff = getEffectiveStatus(inv);
      if (eff === "paid") {
        paidCount++;
      } else if (eff === "overdue" && t.balanceDue > 0) {
        overdue += t.balanceDue;
        overdueCount++;
      } else if (t.balanceDue > 0) {
        pending += t.balanceDue;
        pendingCount++;
      }
    });

  return {
    currency,
    totalEarned: round2(totalEarned),
    pending: round2(pending),
    pendingCount,
    overdue: round2(overdue),
    overdueCount,
    avgDays: paidCount > 0 ? 14 : null,
  };
}

function computeClients(
  invoices: Invoice[],
  currency: CurrencyCode
): ClientSummary[] {
  const map: Record<string, ClientSummary> = {};
  invoices.forEach((inv) => {
    if (!map[inv.client]) {
      map[inv.client] = {
        name: inv.client,
        email: inv.clientEmail,
        invoiceCount: 0,
        totalBilled: 0,
        totalPaid: 0,
        outstanding: 0,
        currency,
      };
    }
    const c = map[inv.client];
    c.invoiceCount++;
    if (!c.email && inv.clientEmail) c.email = inv.clientEmail;
    if (inv.currency === currency) {
      const t = computeInvoiceTotals(inv);
      c.totalBilled += t.total;
      c.totalPaid += t.amountPaid;
    }
  });
  return Object.values(map).map((c) => ({
    ...c,
    totalBilled: round2(c.totalBilled),
    totalPaid: round2(c.totalPaid),
    outstanding: round2(c.totalBilled - c.totalPaid),
  }));
}

const InvoicesContext = createContext<InvoicesContextType | null>(null);

export function InvoicesProvider({ children }: { children: React.ReactNode }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      let list: Invoice[];
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          list = Array.isArray(parsed)
            ? parsed.map(normalizeInvoice)
            : SEED_INVOICES.map(normalizeInvoice);
        } catch {
          list = SEED_INVOICES.map(normalizeInvoice);
        }
      } else {
        list = SEED_INVOICES.map(normalizeInvoice);
      }
      setInvoices(list);
      // Persist normalized shape so the migration runs only once.
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      setIsLoading(false);
    });
  }, []);

  const save = useCallback((next: Invoice[]) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const addInvoice = useCallback(
    (data: InvoiceDraft) => {
      const newInv: Invoice = {
        ...data,
        id: genId(),
        createdAt: new Date().toISOString(),
      };
      setInvoices((prev) => {
        const next = [...prev, newInv];
        save(next);
        return next;
      });
    },
    [save]
  );

  const markPaid = useCallback(
    (id: string) => {
      setInvoices((prev) => {
        const next = prev.map((inv) => {
          if (inv.id !== id) return inv;
          const { total } = computeInvoiceTotals(inv);
          return { ...inv, status: "paid" as InvoiceStatus, amountPaid: total };
        });
        save(next);
        return next;
      });
    },
    [save]
  );

  const recordPayment = useCallback(
    (id: string, amount: number) => {
      setInvoices((prev) => {
        const next = prev.map((inv) => {
          if (inv.id !== id) return inv;
          const { total } = computeInvoiceTotals(inv);
          const paid = round2(
            Math.min(total, Math.max(0, (inv.amountPaid || 0) + amount))
          );
          const status: InvoiceStatus =
            paid >= total - 0.005 ? "paid" : inv.status;
          return { ...inv, amountPaid: paid, status };
        });
        save(next);
        return next;
      });
    },
    [save]
  );

  const updateInvoice = useCallback(
    (id: string, patch: Partial<Invoice>) => {
      setInvoices((prev) => {
        const next = prev.map((inv) =>
          inv.id === id ? { ...inv, ...patch } : inv
        );
        save(next);
        return next;
      });
    },
    [save]
  );

  const deleteInvoice = useCallback(
    (id: string) => {
      setInvoices((prev) => {
        const next = prev.filter((inv) => inv.id !== id);
        save(next);
        return next;
      });
    },
    [save]
  );

  const primaryCurrency = useMemo(
    () => computePrimaryCurrency(invoices),
    [invoices]
  );
  const metrics = useMemo(
    () => computeMetrics(invoices, primaryCurrency),
    [invoices, primaryCurrency]
  );
  const clients = useMemo(
    () => computeClients(invoices, primaryCurrency),
    [invoices, primaryCurrency]
  );

  const nextNum = invoices.length + 1;
  const nextInvNum = `INV-${String(nextNum).padStart(3, "0")}`;

  return (
    <InvoicesContext.Provider
      value={{
        invoices,
        isLoading,
        addInvoice,
        markPaid,
        recordPayment,
        updateInvoice,
        deleteInvoice,
        metrics,
        clients,
        nextInvNum,
        primaryCurrency,
      }}
    >
      {children}
    </InvoicesContext.Provider>
  );
}

export function useInvoices(): InvoicesContextType {
  const ctx = useContext(InvoicesContext);
  if (!ctx) throw new Error("useInvoices must be used within InvoicesProvider");
  return ctx;
}
