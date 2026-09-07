import {
  Invoice,
  computeInvoiceTotals,
  getEffectiveStatus,
} from "@/context/InvoicesContext";
import { NumberFormat, formatMoney } from "@/utils/currency";
import { formatDisplayDate } from "@/utils/date";
import { Alert, Share } from "react-native";

function buildReminderMessage(
  inv: Invoice,
  issuerName: string,
  numberFormat: NumberFormat
): { title: string; message: string } {
  const { total, balanceDue } = computeInvoiceTotals(inv);
  const owed = balanceDue > 0 ? balanceDue : total;
  const amount = formatMoney(owed, inv.currency, numberFormat);
  const dueDate = formatDisplayDate(inv.due);
  const title =
    getEffectiveStatus(inv) === "overdue"
      ? `Payment reminder — ${inv.invnum}`
      : `Invoice reminder — ${inv.invnum}`;
  const message = [
    `Hi ${inv.client},`,
    `I hope you're well. This is a reminder that invoice ${inv.invnum} for ${amount} is due on ${dueDate}.`,
    "Please arrange payment by the due date. If you have any questions or need anything from me, please let me know.",
    `Thank you,\n${issuerName || "Your Name"}`,
  ].join("\n\n");

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