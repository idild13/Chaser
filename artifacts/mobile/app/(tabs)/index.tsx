import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AddInvoiceModal from "@/components/AddInvoiceModal";
import { useColors } from "@/hooks/useColors";
import { useBusinessProfile } from "@/context/BusinessProfileContext";
import {
  Invoice,
  computeInvoiceTotals,
  getEffectiveStatus,
  useInvoices,
} from "@/context/InvoicesContext";
import { CurrencyCode, formatMoney } from "@/utils/currency";
import { sendEmailReminder } from "@/utils/sendEmailReminder";

const AVATAR_COLORS = [
  { bg: "#EEEDFE", color: "#3C3489" },
  { bg: "#E1F5EE", color: "#085041" },
  { bg: "#FAEEDA", color: "#633806" },
  { bg: "#FBEAF0", color: "#72243E" },
  { bg: "#E6F1FB", color: "#0C447C" },
  { bg: "#EAF3DE", color: "#27500A" },
];

function colorFor(name: string) {
  let h = 0;
  for (const c of name) h = (h + c.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function daysUntil(dateStr: string) {
  return Math.round(
    (new Date(dateStr).getTime() - Date.now()) / 86400000
  );
}

function daysAgo(dateStr: string) {
  return Math.round(
    (Date.now() - new Date(dateStr).getTime()) / 86400000
  );
}

function StatusBadge({ status }: { status: Invoice["status"] }) {
  const colors = useColors();
  const config = {
    paid: { bg: colors.successBg, text: colors.successText, label: "Paid" },
    pending: { bg: colors.warningBg, text: colors.warningText, label: "Pending" },
    overdue: { bg: colors.dangerBg, text: colors.dangerText, label: "Overdue" },
  };
  const c = config[status];
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.text }}>{c.label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { invoices, metrics, markPaid } = useInvoices();
  const { profile } = useBusinessProfile();
  const [modalVisible, setModalVisible] = useState(false);

  const fmt = (n: number, currency: CurrencyCode = metrics.currency) =>
    formatMoney(n, currency, profile.numberFormat);

  const recent = [...invoices].slice(-4).reverse();
  const overdue = invoices.filter((i) => getEffectiveStatus(i) === "overdue");
  const pending = invoices.filter((i) => getEffectiveStatus(i) === "pending");

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  async function copyReminder(inv: Invoice) {
    const days = daysAgo(inv.due);
    const text = `Subject: Payment reminder — ${inv.invnum}\n\nHi,\n\nI hope this message finds you well. I wanted to follow up on invoice ${inv.invnum} for ${fmt(computeInvoiceTotals(inv).balanceDue, inv.currency)}, which was due ${days} day${days !== 1 ? "s" : ""} ago.\n\nCould you let me know when we can expect the payment?\n\nBest regards`;
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  const s = styles(colors);

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Good morning</Text>
          <Text style={s.subtitle}>Here's what needs chasing</Text>
        </View>
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => setModalVisible(true)}
        >
          <Feather name="plus" size={15} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          s.content,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 100 },
        ]}
      >
        <View style={s.metricsGrid}>
          <MetricCard
            label="Total Earned"
            value={fmt(metrics.totalEarned)}
            sub="this year"
            valueColor={colors.success}
          />
          <MetricCard
            label="Awaiting"
            value={fmt(metrics.pending)}
            sub={`${metrics.pendingCount} invoice${metrics.pendingCount !== 1 ? "s" : ""}`}
            valueColor={colors.warning}
          />
          <MetricCard
            label="Overdue"
            value={fmt(metrics.overdue)}
            sub={`${metrics.overdueCount} invoice${metrics.overdueCount !== 1 ? "s" : ""}`}
            valueColor={colors.danger}
          />
          <MetricCard
            label="Avg. Payment"
            value={metrics.avgDays != null ? `~${metrics.avgDays}` : "—"}
            sub={metrics.avgDays != null ? "days" : "no payments yet"}
            valueColor={colors.foreground}
          />
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Recent Invoices</Text>
          {recent.length === 0 ? (
            <View style={s.emptyCard}>
              <Feather name="file-text" size={28} color={colors.mutedForeground} />
              <Text style={s.emptyText}>No invoices yet</Text>
            </View>
          ) : (
            <View style={s.card}>
              {recent.map((inv, idx) => {
                const col = colorFor(inv.client);
                return (
                  <View
                    key={inv.id}
                    style={[s.invRow, idx < recent.length - 1 && s.invRowBorder]}
                  >
                    <View style={[s.avatar, { backgroundColor: col.bg }]}>
                      <Text style={[s.avatarText, { color: col.color }]}>
                        {initials(inv.client)}
                      </Text>
                    </View>
                    <View style={s.invInfo}>
                      <Text style={s.invClient}>{inv.client}</Text>
                      <Text style={s.invMeta}>{inv.invnum} · Due {inv.due}</Text>
                    </View>
                    <View style={s.invRight}>
                      <Text style={s.invAmount}>{fmt(computeInvoiceTotals(inv).total, inv.currency)}</Text>
                      <StatusBadge status={getEffectiveStatus(inv)} />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Chase Priority</Text>
          {overdue.length === 0 && pending.length === 0 ? (
            <View style={[s.card, s.aiAllClear]}>
              <Feather name="check-circle" size={20} color={colors.success} />
              <Text style={s.aiAllClearText}>All clear! Every invoice is settled.</Text>
            </View>
          ) : (
            <View style={s.aiList}>
              {overdue.map((inv) => {
                const days = daysAgo(inv.due);
                return (
                  <View key={inv.id} style={s.aiCard}>
                    <View style={s.aiCardHeader}>
                      <View style={[s.aiDot, { backgroundColor: colors.dangerBg }]}>
                        <Feather name="alert-circle" size={14} color={colors.danger} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.aiTitle}>{inv.client}</Text>
                        <Text style={s.aiSub}>
                          {fmt(computeInvoiceTotals(inv).balanceDue, inv.currency)} · {days} day{days !== 1 ? "s" : ""} overdue
                        </Text>
                      </View>
                    </View>
                    <View style={s.aiActions}>
                      <TouchableOpacity
                        style={[s.aiBtn, { backgroundColor: colors.successBg }]}
                        onPress={() => markPaid(inv.id)}
                      >
                        <Feather name="check" size={13} color={colors.success} />
                        <Text style={[s.aiBtnText, { color: colors.successText }]}>Mark paid</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.aiBtn, { backgroundColor: colors.warningBg }]}
                        onPress={() => sendEmailReminder(inv, profile.name, profile.numberFormat)}
                      >
                        <Feather name="mail" size={13} color={colors.warning} />
                        <Text style={[s.aiBtnText, { color: colors.warningText }]}>Send reminder</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.aiBtn, { backgroundColor: colors.infoBg }]}
                        onPress={() => copyReminder(inv)}
                      >
                        <Feather name="copy" size={13} color={colors.info} />
                        <Text style={[s.aiBtnText, { color: colors.infoText }]}>Copy</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
              {pending.map((inv) => {
                const days = daysUntil(inv.due);
                const isUrgent = days <= 3;
                return (
                  <View key={inv.id} style={s.aiCard}>
                    <View style={s.aiCardHeader}>
                      <View
                        style={[
                          s.aiDot,
                          {
                            backgroundColor: isUrgent
                              ? colors.dangerBg
                              : colors.warningBg,
                          },
                        ]}
                      >
                        <Feather
                          name={isUrgent ? "alert-triangle" : "calendar"}
                          size={14}
                          color={isUrgent ? colors.danger : colors.warning}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.aiTitle}>{inv.client}</Text>
                        <Text style={s.aiSub}>
                          {fmt(computeInvoiceTotals(inv).balanceDue, inv.currency)} · due{" "}
                          {days > 0
                            ? `in ${days} day${days !== 1 ? "s" : ""}`
                            : "today"}
                        </Text>
                      </View>
                    </View>
                    <View style={s.aiActions}>
                      <TouchableOpacity
                        style={[s.aiBtn, { backgroundColor: colors.successBg }]}
                        onPress={() => markPaid(inv.id)}
                      >
                        <Feather name="check" size={13} color={colors.success} />
                        <Text style={[s.aiBtnText, { color: colors.successText }]}>Mark paid</Text>
                      </TouchableOpacity>
                      {isUrgent && (
                        <TouchableOpacity
                          style={[s.aiBtn, { backgroundColor: colors.warningBg }]}
                          onPress={() => sendEmailReminder(inv, profile.name, profile.numberFormat)}
                        >
                          <Feather name="mail" size={13} color={colors.warning} />
                          <Text style={[s.aiBtnText, { color: colors.warningText }]}>Send reminder</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <AddInvoiceModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

function MetricCard({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: string;
  sub: string;
  valueColor: string;
}) {
  const colors = useColors();
  const s = metricStyles(colors);
  return (
    <View style={s.card}>
      <Text style={s.label}>{label}</Text>
      <Text style={[s.value, { color: valueColor }]}>{value}</Text>
      <Text style={s.sub}>{sub}</Text>
    </View>
  );
}

const metricStyles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 14,
      minWidth: "47%",
    },
    label: {
      fontSize: 11,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
      marginBottom: 6,
    },
    value: {
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      marginBottom: 2,
    },
    sub: {
      fontSize: 11,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
  });

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    greeting: {
      fontSize: 24,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    subtitle: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 2,
    },
    addBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "flex-end",
    },
    content: {
      paddingHorizontal: 16,
      gap: 20,
    },
    metricsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    section: {
      gap: 12,
    },
    sectionTitle: {
      fontSize: 17,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      overflow: "hidden",
    },
    emptyCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 32,
      alignItems: "center",
      gap: 8,
    },
    emptyText: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    invRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
    },
    invRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      fontSize: 13,
      fontFamily: "Inter_700Bold",
    },
    invInfo: {
      flex: 1,
    },
    invClient: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    invMeta: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 2,
    },
    invRight: {
      alignItems: "flex-end",
      gap: 4,
    },
    invAmount: {
      fontSize: 14,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    aiAllClear: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 16,
    },
    aiAllClearText: {
      fontSize: 14,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
    },
    aiList: {
      gap: 10,
    },
    aiCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 14,
      gap: 12,
    },
    aiCardHeader: {
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
    },
    aiDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    aiTitle: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    aiSub: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 2,
    },
    aiActions: {
      flexDirection: "row",
      gap: 8,
    },
    aiBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8,
    },
    aiBtnText: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
    },
  });
