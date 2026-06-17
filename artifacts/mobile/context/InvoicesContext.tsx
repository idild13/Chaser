import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type InvoiceStatus = "pending" | "paid" | "overdue";

export interface Invoice {
  id: string;
  client: string;
  invnum: string;
  amount: number;
  due: string;
  desc: string;
  status: InvoiceStatus;
  createdAt: string;
}

export interface ClientSummary {
  name: string;
  invoiceCount: number;
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
}

export interface Metrics {
  totalEarned: number;
  pending: number;
  pendingCount: number;
  overdue: number;
  overdueCount: number;
  avgDays: number | null;
}

interface InvoicesContextType {
  invoices: Invoice[];
  isLoading: boolean;
  addInvoice: (data: Omit<Invoice, "id" | "createdAt">) => void;
  markPaid: (id: string) => void;
  deleteInvoice: (id: string) => void;
  metrics: Metrics;
  clients: ClientSummary[];
  nextInvNum: string;
}

const STORAGE_KEY = "fp_invoices";

const SEED_INVOICES: Invoice[] = [
  {
    id: "1",
    client: "Müller Design",
    invnum: "INV-001",
    amount: 2400,
    due: "2026-06-01",
    desc: "Brand identity package",
    status: "paid",
    createdAt: "2026-05-01T00:00:00.000Z",
  },
  {
    id: "2",
    client: "TechStart GmbH",
    invnum: "INV-002",
    amount: 1800,
    due: "2026-06-10",
    desc: "Landing page development",
    status: "overdue",
    createdAt: "2026-05-10T00:00:00.000Z",
  },
  {
    id: "3",
    client: "Bright Agency",
    invnum: "INV-003",
    amount: 950,
    due: "2026-07-25",
    desc: "Social media graphics",
    status: "pending",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
];

function computeMetrics(invoices: Invoice[]): Metrics {
  let totalEarned = 0;
  let pending = 0;
  let pendingCount = 0;
  let overdue = 0;
  let overdueCount = 0;

  invoices.forEach((inv) => {
    if (inv.status === "paid") totalEarned += inv.amount;
    if (inv.status === "pending") {
      pending += inv.amount;
      pendingCount++;
    }
    if (inv.status === "overdue") {
      overdue += inv.amount;
      overdueCount++;
    }
  });

  return {
    totalEarned,
    pending,
    pendingCount,
    overdue,
    overdueCount,
    avgDays: invoices.filter((i) => i.status === "paid").length > 0 ? 14 : null,
  };
}

function computeClients(invoices: Invoice[]): ClientSummary[] {
  const map: Record<string, ClientSummary> = {};
  invoices.forEach((inv) => {
    if (!map[inv.client]) {
      map[inv.client] = {
        name: inv.client,
        invoiceCount: 0,
        totalBilled: 0,
        totalPaid: 0,
        outstanding: 0,
      };
    }
    map[inv.client].invoiceCount++;
    map[inv.client].totalBilled += inv.amount;
    if (inv.status === "paid") map[inv.client].totalPaid += inv.amount;
  });
  return Object.values(map).map((c) => ({
    ...c,
    outstanding: c.totalBilled - c.totalPaid,
  }));
}

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

const InvoicesContext = createContext<InvoicesContextType | null>(null);

export function InvoicesProvider({ children }: { children: React.ReactNode }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          setInvoices(JSON.parse(raw));
        } catch {
          setInvoices(SEED_INVOICES);
        }
      } else {
        setInvoices(SEED_INVOICES);
      }
      setIsLoading(false);
    });
  }, []);

  const save = useCallback((next: Invoice[]) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const addInvoice = useCallback(
    (data: Omit<Invoice, "id" | "createdAt">) => {
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
        const next = prev.map((inv) =>
          inv.id === id ? { ...inv, status: "paid" as InvoiceStatus } : inv
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

  const metrics = computeMetrics(invoices);
  const clients = computeClients(invoices);

  const nextNum = invoices.length + 1;
  const nextInvNum = `INV-${String(nextNum).padStart(3, "0")}`;

  return (
    <InvoicesContext.Provider
      value={{
        invoices,
        isLoading,
        addInvoice,
        markPaid,
        deleteInvoice,
        metrics,
        clients,
        nextInvNum,
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
