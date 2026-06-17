import { Invoice } from "@/context/InvoicesContext";
import * as Linking from "expo-linking";
import { Alert } from "react-native";

function fmtCurrency(n: number) {
  return "€" + n.toLocaleString("de-DE", { minimumFractionDigits: 2 });
}

function daysAgo(dateStr: string) {
  return Math.max(
    0,
    Math.round((Date.now() - new Date(dateStr).getTime()) / 86400000)
  );
}

function daysUntil(dateStr: string) {
  return Math.round(
    (new Date(dateStr).getTime() - Date.now()) / 86400000
  );
}

function buildReminderEmail(inv: Invoice, issuerName: string): { subject: string; body: string } {
  const amount = fmtCurrency(inv.amount);

  if (inv.status === "overdue") {
    const days = daysAgo(inv.due);
    const subject = `Payment Reminder — ${inv.invnum}`;
    const body = [
      `Hi,`,
      ``,
      `I hope this message finds you well. I'm following up on invoice ${inv.invnum} for ${amount}, which was due on ${inv.due} — ${days} day${days !== 1 ? "s" : ""} ago.`,
      ``,
      `Could you please let me know when we can expect the payment, or if there is anything I can help clarify? I'd appreciate hearing from you at your earliest convenience.`,
      ``,
      `Please don't hesitate to reach out if you have any questions.`,
      ``,
      `Best regards,`,
      issuerName || "Your Name",
    ].join("\n");
    return { subject, body };
  }

  const days = daysUntil(inv.due);
  const subject = `Invoice ${inv.invnum} — Due ${days <= 0 ? "Today" : `in ${days} Day${days !== 1 ? "s" : ""}`}`;
  const body = [
    `Hi,`,
    ``,
    `I hope you're doing well. This is a friendly reminder that invoice ${inv.invnum} for ${amount} is due on ${inv.due}${days <= 0 ? " — today" : ""}.`,
    ``,
    `Please let me know if you have any questions or need anything else from me.`,
    ``,
    `Thank you,`,
    issuerName || "Your Name",
  ].join("\n");
  return { subject, body };
}

export async function sendEmailReminder(
  inv: Invoice,
  issuerName = ""
): Promise<void> {
  const { subject, body } = buildReminderEmail(inv, issuerName);

  const params = new URLSearchParams({ subject, body });
  const url = `mailto:?${params.toString()}`;

  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    Alert.alert(
      "No Email App Found",
      "Please install a mail app to send reminders.",
      [{ text: "OK" }]
    );
    return;
  }

  await Linking.openURL(url);
}
