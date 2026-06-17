import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useInvoices } from "@/context/InvoicesContext";

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

function fmtCurrency(n: number) {
  return "€" + n.toLocaleString("de-DE");
}

export default function ClientsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { clients, invoices } = useInvoices();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const s = styles(colors);

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <View style={s.header}>
        <Text style={s.title}>Clients</Text>
        <Text style={s.subtitle}>
          {clients.length} client{clients.length !== 1 ? "s" : ""} · from your invoices
        </Text>
      </View>

      <FlatList
        data={clients}
        keyExtractor={(item) => item.name}
        scrollEnabled={clients.length > 0}
        contentContainerStyle={[
          s.listContent,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 100 },
        ]}
        ListEmptyComponent={
          <View style={s.empty}>
            <Feather name="users" size={40} color={colors.border} />
            <Text style={s.emptyTitle}>No clients yet</Text>
            <Text style={s.emptyText}>Clients are derived from your invoices</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item: client }) => {
          const col = colorFor(client.name);
          const paidPct =
            client.totalBilled > 0
              ? (client.totalPaid / client.totalBilled) * 100
              : 0;
          const clientInvoices = invoices.filter(
            (i) => i.client === client.name
          );

          return (
            <View style={s.clientCard}>
              <View style={s.cardTop}>
                <View style={[s.avatar, { backgroundColor: col.bg }]}>
                  <Text style={[s.avatarText, { color: col.color }]}>
                    {initials(client.name)}
                  </Text>
                </View>
                <View style={s.clientInfo}>
                  <Text style={s.clientName}>{client.name}</Text>
                  <Text style={s.clientSub}>
                    {client.invoiceCount} invoice{client.invoiceCount !== 1 ? "s" : ""}
                  </Text>
                </View>
                <View style={s.clientRight}>
                  <Text style={s.totalPaid}>{fmtCurrency(client.totalPaid)}</Text>
                  <Text style={s.totalPaidLabel}>received</Text>
                </View>
              </View>

              <View style={s.progressSection}>
                <View style={s.progressBg}>
                  <View
                    style={[
                      s.progressFill,
                      {
                        width: `${paidPct}%` as `${number}%`,
                        backgroundColor:
                          paidPct === 100 ? colors.success : colors.primary,
                      },
                    ]}
                  />
                </View>
                <Text style={s.progressLabel}>
                  {Math.round(paidPct)}% collected of {fmtCurrency(client.totalBilled)}
                </Text>
              </View>

              {client.outstanding > 0 && (
                <View style={s.outstandingRow}>
                  <Feather
                    name="alert-circle"
                    size={13}
                    color={colors.warning}
                  />
                  <Text style={s.outstandingText}>
                    {fmtCurrency(client.outstanding)} outstanding
                  </Text>
                </View>
              )}

              <View style={s.invoiceList}>
                {clientInvoices.map((inv) => (
                  <View key={inv.id} style={s.miniInv}>
                    <Text style={s.miniInvNum}>{inv.invnum}</Text>
                    <Text style={s.miniInvDesc} numberOfLines={1}>
                      {inv.desc || inv.invnum}
                    </Text>
                    <StatusDot status={inv.status} />
                  </View>
                ))}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

function StatusDot({ status }: { status: "pending" | "paid" | "overdue" }) {
  const colors = useColors();
  const dotColors = {
    paid: colors.success,
    pending: colors.warning,
    overdue: colors.danger,
  };
  return (
    <View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: dotColors[status],
      }}
    />
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    title: {
      fontSize: 24,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    subtitle: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 2,
    },
    listContent: {
      paddingHorizontal: 16,
    },
    empty: {
      alignItems: "center",
      paddingTop: 80,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      marginTop: 8,
    },
    emptyText: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    clientCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      gap: 14,
    },
    cardTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    avatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
    },
    clientInfo: {
      flex: 1,
    },
    clientName: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    clientSub: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 2,
    },
    clientRight: {
      alignItems: "flex-end",
    },
    totalPaid: {
      fontSize: 17,
      fontFamily: "Inter_700Bold",
      color: colors.success,
    },
    totalPaidLabel: {
      fontSize: 11,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 1,
    },
    progressSection: {
      gap: 6,
    },
    progressBg: {
      height: 6,
      backgroundColor: colors.muted,
      borderRadius: 3,
      overflow: "hidden",
    },
    progressFill: {
      height: 6,
      borderRadius: 3,
    },
    progressLabel: {
      fontSize: 11,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    outstandingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.warningBg,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    outstandingText: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.warningText,
    },
    invoiceList: {
      gap: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 10,
    },
    miniInv: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    miniInvNum: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      width: 60,
    },
    miniInvDesc: {
      flex: 1,
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
  });
