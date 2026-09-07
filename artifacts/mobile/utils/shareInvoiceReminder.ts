import {
  Invoice,
  computeInvoiceTotals,
  getEffectiveStatus,
} from "@/context/InvoicesContext";
import { NumberFormat, formatMoney } from "@/utils/currency";
import { formatDisplayDate } from "@/utils/date";
import { Alert, Share } from "react-native";

function daysAgo(dateStr: string) {
  return Math.max(
    0,
    Math.round((Date.now() - new Date(dateStr).getTime()) / 86400000)
  );
}

function daysUntil(dateStr: string) {
  return Math.round((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function buildReminderMessage(
  inv: Invoice,
  issuerName: string,
  numberFormat: NumberFormat
): { title: string; message: string } {
  const { total, balanceDue } = computeInvoiceTotals(inv);
  const owed = balanceDue > 0 ? balanceDue : total;
  const amount = formatMoney(owed, inv.currency, numberFormat);
  const dueDate = formatDisplayDate(inv.due);
  const greeting = `Hi ${inv.client},`;

  if (getEffectiveStatus(inv) === "overdue") {
    const days = daysAgo(inv.due);
    const title = `Payment reminder — ${inv.invnum}`;
    const message = [
      title,
      "",
      greeting,
      "",
      `I hope you're well. I'm following up on invoice ${inv.invnum} for ${amount}, which was due on ${dueDate} — ${days} day${days !== 1 ? "s" : ""} ago.`,
      "",
      "Could you please confirm when payment will be made? If there is anything you need from me to process it, please let me know.",
      "",
      "Thank you for your prompt attention to this.",
      "",
      "Best regards,",
      issuerName || "Your Name",
    ].join("\n");
    return { title, message };
  }

  const days = daysUntil(inv.due);
  const title = `Invoice reminder — ${inv.invnum}`;
  const message = [
    title,
    "",
    greeting,
    "",
    `I hope you're well. This is a reminder that invoice ${inv.invnum} for ${amount} is due on ${dueDate}${days <= 0 ? " — today" : ""}.`,
    "",
    "Please arrange payment by the due date. If you have any questions or need anything from me, please let me know.",
    "",
    "Thank you,",
    issuerName || "Your Name",
  ].join("\n");
  return { title, message };
}

export async function shareInvoiceReminder(
  inv: Invoice,
  issuerName = "",
  numberFormat: NumberFormat = "comma-dot"
): Promise<void> {
  const { title, message } = buildReminderMessage(
    inv,
    issuerName,
    numberFormat
  );

  try {
    await Share.share({ title, message });
  } catch {
    Alert.alert(
      "Unable to Share",
      "The reminder could not be opened in the share sheet. Please try again."
    );
  }
}