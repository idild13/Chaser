import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AddInvoiceModal from "@/components/AddInvoiceModal";
import IssuerProfileModal from "@/components/IssuerProfileModal";
import { useColors } from "@/hooks/useColors";
import {
  BusinessProfile,
  useBusinessProfile,
} from "@/context/BusinessProfileContext";
import {
  Invoice,
  InvoiceStatus,
  computeInvoiceTotals,
  getEffectiveStatus,
  useInvoices,
} from "@/context/InvoicesContext";
import { formatMoney } from "@/utils/currency";
import { confirmAction } from "@/utils/confirm";
import { exportInvoicePDF } from "@/utils/generateInvoicePDF";
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

function lineSummary(inv: Invoice): string {
  const items = inv.lineItems ?? [];
  if (items.length === 0) return inv.desc || inv.invnum;
  const first = items[0].description || "Item";
  return items.length > 1 ? `${first} +${items.length - 1} more` : first;
}

type Filter = "all" | InvoiceStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid" },
];

export default function InvoicesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { invoices, markPaid, deleteInvoice } = useInvoices();
  const { profile, saveProfile, hasProfile } = useBusinessProfile();

  const fmt = (n: number, currency: Invoice["currency"]) =>
    formatMoney(n, currency, profile.numberFormat);

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [pendingExportInv, setPendingExportInv] = useState<Invoice | null>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);

  const filtered = invoices
    .filter((inv) => filter === "all" || getEffectiveStatus(inv) === filter)
    .filter(
      (inv) =>
        !search ||
        inv.client.toLowerCase().includes(search.toLowerCase()) ||
        inv.invnum.toLowerCase().includes(search.toLowerCase())
    )
    .reverse();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  function handleDelete(inv: Invoice) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    confirmAction({
      title: "Delete Invoice",
      message: `Delete ${inv.invnum} for ${inv.client}?`,
      confirmText: "Delete",
      destructive: true,
      onConfirm: () => {
        deleteInvoice(inv.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    });
  }

  function handleMarkPaid(inv: Invoice) {
    markPaid(inv.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function handleExportPDF(inv: Invoice) {
    if (!hasProfile) {
      setPendingExportInv(inv);
      setProfileModalVisible(true);
      return;
    }
    await doExport(inv, profile);
  }

  async function doExport(inv: Invoice, prof: BusinessProfile) {
    setExportingId(inv.id);
    try {
      await exportInvoicePDF(inv, prof);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert("Export Failed", "Could not generate the PDF. Please try again.");
    } finally {
      setExportingId(null);
    }
  }

  async function handleProfileSave(p: { name: string; email: string }) {
    saveProfile(p);
    setProfileModalVisible(false);
    if (pendingExportInv) {
      const inv = pendingExportInv;
      setPendingExportInv(null);
      await doExport(inv, { ...profile, ...p });
    }
  }

  const s = styles(colors);

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Invoices</Text>
          <Text style={s.subtitle}>
            {invoices.length} total · {invoices.filter((i) => getEffectiveStatus(i) === "paid").length} paid
          </Text>
        </View>
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => setAddModalVisible(true)}
        >
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={s.searchInput}
            placeholder="Search client or invoice..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x-circle" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={s.filterRow}>
        {FILTERS.map((f) => {
          const isActive = filter === f.key;
          const count =
            f.key === "all"
              ? invoices.length
              : invoices.filter((i) => getEffectiveStatus(i) === f.key).length;
          return (
            <TouchableOpacity
              key={f.key}
              style={[s.filterBtn, isActive && s.filterBtnActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[s.filterBtnText, isActive && s.filterBtnTextActive]}>
                {f.label}
              </Text>
              {count > 0 && (
                <View
                  style={[
                    s.filterCount,
                    isActive && { backgroundColor: colors.primary + "20" },
                  ]}
                >
                  <Text
                    style={[
                      s.filterCountText,
                      isActive && { color: colors.primary },
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        scrollEnabled={filtered.length > 0}
        contentContainerStyle={[
          s.listContent,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 100 },
        ]}
        ListEmptyComponent={
          <View style={s.empty}>
            <Feather name="file-text" size={40} color={colors.border} />
            <Text style={s.emptyTitle}>No invoices found</Text>
            <Text style={s.emptyText}>
              {search ? "Try a different search term" : "Tap + to add your first invoice"}
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={s.separator} />}
        renderItem={({ item: inv }) => {
          const col = colorFor(inv.client);
          const isExporting = exportingId === inv.id;

          return (
            <View style={s.invCard}>
              <View style={s.invCardTop}>
                <View style={[s.avatar, { backgroundColor: col.bg }]}>
                  <Text style={[s.avatarText, { color: col.color }]}>
                    {initials(inv.client)}
                  </Text>
                </View>
                <View style={s.invInfo}>
                  <Text style={s.invClient}>{inv.client}</Text>
                  <Text style={s.invDesc} numberOfLines={1}>{lineSummary(inv)}</Text>
                </View>
                <View style={s.invRightCol}>
                  <Text style={s.invAmount}>{fmt(computeInvoiceTotals(inv).total, inv.currency)}</Text>
                  <StatusBadge status={getEffectiveStatus(inv)} />
                </View>
              </View>

              <View style={s.invCardBottom}>
                <View style={s.invMeta}>
                  <Feather name="hash" size={11} color={colors.mutedForeground} />
                  <Text style={s.invMetaText}>{inv.invnum}</Text>
                  <Feather
                    name="calendar"
                    size={11}
                    color={colors.mutedForeground}
                    style={{ marginLeft: 8 }}
                  />
                  <Text style={s.invMetaText}>Due {inv.due}</Text>
                </View>

                <View style={s.invActions}>
                  {getEffectiveStatus(inv) !== "paid" && (
                    <TouchableOpacity
                      style={s.actionBtnPay}
                      onPress={() => handleMarkPaid(inv)}
                    >
                      <Feather name="check" size={12} color={colors.success} />
                      <Text style={[s.actionBtnText, { color: colors.success }]}>
                        Paid
                      </Text>
                    </TouchableOpacity>
                  )}
                  {getEffectiveStatus(inv) !== "paid" && (
                    <TouchableOpacity
                      style={s.actionBtnEmail}
                      onPress={() => sendEmailReminder(inv, profile.name, profile.numberFormat)}
                    >
                      <Feather name="mail" size={13} color={colors.warning} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={s.actionBtnPDF}
                    onPress={() => handleExportPDF(inv)}
                    disabled={isExporting}
                  >
                    {isExporting ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Feather name="download" size={13} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.actionBtnDel}
                    onPress={() => handleDelete(inv)}
                  >
                    <Feather name="trash-2" size={12} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
      />

      <AddInvoiceModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
      />

      <IssuerProfileModal
        visible={profileModalVisible}
        initial={{ name: profile.name, email: profile.email }}
        onSave={handleProfileSave}
        onCancel={() => {
          setProfileModalVisible(false);
          setPendingExportInv(null);
        }}
        title="Your Invoice Details"
      />
    </View>
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
    <View
      style={{
        backgroundColor: c.bg,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}
    >
      <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.text }}>
        {c.label}
      </Text>
    </View>
  );
}

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
    addBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    searchRow: {
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
      gap: 10,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    filterRow: {
      flexDirection: "row",
      paddingHorizontal: 16,
      gap: 8,
      marginBottom: 12,
    },
    filterBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: colors.card,
    },
    filterBtnActive: {
      backgroundColor: colors.primary + "15",
    },
    filterBtnText: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
    },
    filterBtnTextActive: {
      color: colors.primary,
      fontFamily: "Inter_700Bold",
    },
    filterCount: {
      backgroundColor: colors.muted,
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    filterCountText: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
    },
    listContent: {
      paddingHorizontal: 16,
    },
    separator: {
      height: 10,
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
    invCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 14,
      gap: 12,
    },
    invCardTop: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      fontSize: 14,
      fontFamily: "Inter_700Bold",
    },
    invInfo: {
      flex: 1,
    },
    invClient: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    invDesc: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 3,
    },
    invRightCol: {
      alignItems: "flex-end",
      gap: 5,
    },
    invAmount: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    invCardBottom: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 10,
      gap: 10,
    },
    invMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      flexWrap: "wrap",
    },
    invMetaText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    invActions: {
      flexDirection: "row",
      gap: 6,
      alignItems: "center",
      justifyContent: "flex-end",
    },
    actionBtnPay: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.successBg,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
    },
    actionBtnText: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
    },
    actionBtnPDF: {
      backgroundColor: colors.primary + "15",
      padding: 7,
      borderRadius: 8,
      width: 30,
      height: 30,
      alignItems: "center",
      justifyContent: "center",
    },
    actionBtnEmail: {
      backgroundColor: colors.warningBg,
      padding: 7,
      borderRadius: 8,
      width: 30,
      height: 30,
      alignItems: "center",
      justifyContent: "center",
    },
    actionBtnDel: {
      backgroundColor: colors.dangerBg,
      padding: 7,
      borderRadius: 8,
    },
  });
