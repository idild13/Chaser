import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { Invoice, computeInvoiceTotals } from "@/context/InvoicesContext";
import { NumberFormat, currencySymbol, formatMoney } from "@/utils/currency";

interface Props {
  visible: boolean;
  invoice: Invoice | null;
  numberFormat: NumberFormat;
  onRecord: (amount: number) => void;
  onClose: () => void;
}

export default function RecordPaymentModal({
  visible,
  invoice,
  numberFormat,
  onRecord,
  onClose,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const totals = invoice
    ? computeInvoiceTotals(invoice)
    : { total: 0, amountPaid: 0, balanceDue: 0 };

  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && invoice) {
      const bal = computeInvoiceTotals(invoice).balanceDue;
      setAmount(bal > 0 ? bal.toFixed(2) : "");
      setError(null);
    }
  }, [visible, invoice]);

  const fmt = (n: number) =>
    formatMoney(n, invoice?.currency ?? "EUR", numberFormat);

  const parsed = parseFloat(amount.replace(",", "."));
  const willSettle =
    !isNaN(parsed) &&
    totals.balanceDue > 0 &&
    parsed >= totals.balanceDue - 0.005;

  function handleRecord() {
    const cleaned = amount.replace(",", ".").trim();
    const amt = parseFloat(cleaned);
    if (!/^\d*\.?\d+$/.test(cleaned) || isNaN(amt) || amt <= 0) {
      setError("Enter an amount greater than 0");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    onRecord(amt);
  }

  const s = styles(colors);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={s.overlay} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={s.avoidView}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}
          >
            <View style={s.handle} />

            <View style={s.header}>
              <View style={s.iconWrap}>
                <Feather name="dollar-sign" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>Record Payment</Text>
                {!!invoice && (
                  <Text style={s.subtitle}>
                    {invoice.invnum} · {invoice.client}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={onClose} style={s.closeBtn}>
                <Feather name="x" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <View style={s.summary}>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Invoice total</Text>
                <Text style={s.summaryValue}>{fmt(totals.total)}</Text>
              </View>
              {totals.amountPaid > 0 && (
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Already paid</Text>
                  <Text style={s.summaryValue}>{fmt(totals.amountPaid)}</Text>
                </View>
              )}
              <View style={[s.summaryRow, s.summaryRowLast]}>
                <Text style={s.balanceLabel}>Balance due</Text>
                <Text style={s.balanceValue}>{fmt(totals.balanceDue)}</Text>
              </View>
            </View>

            <View style={s.field}>
              <Text style={s.label}>Payment amount</Text>
              <View style={[s.amountBox, error ? s.amountBoxError : null]}>
                <Text style={s.currency}>
                  {currencySymbol(invoice?.currency ?? "EUR")}
                </Text>
                <TextInput
                  style={s.amountInput}
                  value={amount}
                  onChangeText={(t) => {
                    setAmount(t);
                    if (error) setError(null);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  testID="record-payment-amount"
                />
              </View>
              {error ? (
                <Text style={s.errorText}>{error}</Text>
              ) : (
                <Text style={s.hint}>
                  {willSettle
                    ? "Settles the balance and marks this invoice as paid."
                    : "Logs a partial payment and keeps the balance open."}
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={s.recordBtn}
              onPress={handleRecord}
              testID="record-payment-submit"
            >
              <Feather
                name={willSettle ? "check" : "plus"}
                size={16}
                color="#fff"
              />
              <Text style={s.recordBtnText}>
                {willSettle ? "Mark as Paid" : "Record Payment"}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    avoidView: { justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 8,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      alignSelf: "center",
      marginBottom: 20,
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      marginBottom: 18,
    },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.successBg,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      fontSize: 17,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    subtitle: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 2,
    },
    closeBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    summary: {
      backgroundColor: colors.muted,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 6,
      marginBottom: 18,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    summaryRowLast: {
      borderBottomWidth: 0,
    },
    summaryLabel: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    summaryValue: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    balanceLabel: {
      fontSize: 13,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    balanceValue: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
      color: colors.primary,
    },
    field: { marginBottom: 16 },
    label: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    amountBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.muted,
      borderRadius: 10,
      paddingHorizontal: 14,
      borderWidth: 1.5,
      borderColor: "transparent",
    },
    amountBoxError: {
      borderColor: colors.danger,
    },
    currency: {
      fontSize: 18,
      fontFamily: "Inter_700Bold",
      color: colors.mutedForeground,
    },
    amountInput: {
      flex: 1,
      paddingVertical: 13,
      fontSize: 18,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    hint: {
      fontSize: 11,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 6,
    },
    errorText: {
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      color: colors.danger,
      marginTop: 6,
    },
    recordBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 15,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 4,
    },
    recordBtnText: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
      color: "#FFFFFF",
    },
  });
