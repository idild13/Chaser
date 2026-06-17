import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { InvoiceStatus, useInvoices } from "@/context/InvoicesContext";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function AddInvoiceModal({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addInvoice, nextInvNum } = useInvoices();

  const [client, setClient] = useState("");
  const [invnum, setInvnum] = useState(nextInvNum);
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const [desc, setDesc] = useState("");
  const [status, setStatus] = useState<InvoiceStatus>("pending");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      setInvnum(nextInvNum);
      setClient("");
      setAmount("");
      setDesc("");
      setStatus("pending");
      setErrors({});
      const defaultDue = new Date();
      defaultDue.setDate(defaultDue.getDate() + 30);
      setDue(defaultDue.toISOString().split("T")[0]);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 600,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, nextInvNum]);

  function validate() {
    const e: Record<string, string> = {};
    if (!client.trim()) e.client = "Client name is required";
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) e.amount = "Enter a valid amount";
    if (!due) e.due = "Due date is required";
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) e.due = "Format: YYYY-MM-DD";
    return e;
  }

  function handleAdd() {
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    addInvoice({
      client: client.trim(),
      invnum: invnum.trim() || nextInvNum,
      amount: parseFloat(amount),
      due,
      desc: desc.trim(),
      status,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  }

  const statusOptions: { value: InvoiceStatus; label: string }[] = [
    { value: "pending", label: "Pending" },
    { value: "paid", label: "Paid" },
    { value: "overdue", label: "Overdue" },
  ];

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
          <Animated.View
            style={[
              s.sheet,
              { transform: [{ translateY: slideAnim }] },
              { paddingBottom: insets.bottom + 8 },
            ]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={s.handle} />

              <View style={s.header}>
                <Text style={s.title}>New Invoice</Text>
                <TouchableOpacity onPress={onClose} style={s.closeBtn}>
                  <Feather name="x" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View style={s.row}>
                  <View style={[s.field, { flex: 2 }]}>
                    <Text style={s.label}>Client Name</Text>
                    <TextInput
                      style={[s.input, errors.client ? s.inputError : null]}
                      placeholder="e.g. Acme GmbH"
                      placeholderTextColor={colors.mutedForeground}
                      value={client}
                      onChangeText={(t) => {
                        setClient(t);
                        setErrors((e) => ({ ...e, client: "" }));
                      }}
                      autoCapitalize="words"
                    />
                    {!!errors.client && (
                      <Text style={s.errorText}>{errors.client}</Text>
                    )}
                  </View>
                  <View style={[s.field, { flex: 1 }]}>
                    <Text style={s.label}>Invoice #</Text>
                    <TextInput
                      style={s.input}
                      placeholder={nextInvNum}
                      placeholderTextColor={colors.mutedForeground}
                      value={invnum}
                      onChangeText={setInvnum}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>

                <View style={s.row}>
                  <View style={[s.field, { flex: 1 }]}>
                    <Text style={s.label}>Amount (€)</Text>
                    <TextInput
                      style={[s.input, errors.amount ? s.inputError : null]}
                      placeholder="1500"
                      placeholderTextColor={colors.mutedForeground}
                      value={amount}
                      onChangeText={(t) => {
                        setAmount(t);
                        setErrors((e) => ({ ...e, amount: "" }));
                      }}
                      keyboardType="decimal-pad"
                    />
                    {!!errors.amount && (
                      <Text style={s.errorText}>{errors.amount}</Text>
                    )}
                  </View>
                  <View style={[s.field, { flex: 1 }]}>
                    <Text style={s.label}>Due Date</Text>
                    <TextInput
                      style={[s.input, errors.due ? s.inputError : null]}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.mutedForeground}
                      value={due}
                      onChangeText={(t) => {
                        setDue(t);
                        setErrors((e) => ({ ...e, due: "" }));
                      }}
                      keyboardType="numbers-and-punctuation"
                    />
                    {!!errors.due && (
                      <Text style={s.errorText}>{errors.due}</Text>
                    )}
                  </View>
                </View>

                <View style={s.field}>
                  <Text style={s.label}>Description</Text>
                  <TextInput
                    style={[s.input, s.textArea]}
                    placeholder="e.g. Website redesign — June 2026"
                    placeholderTextColor={colors.mutedForeground}
                    value={desc}
                    onChangeText={setDesc}
                    multiline
                    numberOfLines={2}
                  />
                </View>

                <View style={s.field}>
                  <Text style={s.label}>Status</Text>
                  <View style={s.statusRow}>
                    {statusOptions.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          s.statusBtn,
                          status === opt.value && s.statusBtnActive,
                          status === opt.value && {
                            borderColor: statusColor(opt.value, colors),
                            backgroundColor: statusBg(opt.value, colors),
                          },
                        ]}
                        onPress={() => setStatus(opt.value)}
                      >
                        <Text
                          style={[
                            s.statusBtnText,
                            status === opt.value && {
                              color: statusColor(opt.value, colors),
                              fontFamily: "Inter_600SemiBold",
                            },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity style={s.addBtn} onPress={handleAdd}>
                  <Text style={s.addBtnText}>Add Invoice</Text>
                </TouchableOpacity>
              </ScrollView>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

function statusColor(status: InvoiceStatus, colors: ReturnType<typeof useColors>) {
  if (status === "paid") return colors.success;
  if (status === "overdue") return colors.danger;
  return colors.warning;
}

function statusBg(status: InvoiceStatus, colors: ReturnType<typeof useColors>) {
  if (status === "paid") return colors.successBg;
  if (status === "overdue") return colors.dangerBg;
  return colors.warningBg;
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    avoidView: {
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 8,
      maxHeight: "90%",
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      alignSelf: "center",
      marginBottom: 16,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 20,
    },
    title: {
      fontSize: 20,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    row: {
      flexDirection: "row",
      gap: 12,
    },
    field: {
      marginBottom: 16,
    },
    label: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      marginBottom: 6,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    input: {
      backgroundColor: colors.muted,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      borderWidth: 1,
      borderColor: "transparent",
    },
    inputError: {
      borderColor: colors.danger,
    },
    textArea: {
      minHeight: 60,
      textAlignVertical: "top",
    },
    errorText: {
      fontSize: 11,
      color: colors.danger,
      marginTop: 4,
      fontFamily: "Inter_400Regular",
    },
    statusRow: {
      flexDirection: "row",
      gap: 8,
    },
    statusBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
      backgroundColor: colors.muted,
      borderWidth: 1.5,
      borderColor: "transparent",
    },
    statusBtnActive: {},
    statusBtnText: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
    },
    addBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 8,
      marginBottom: 8,
    },
    addBtnText: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
      color: "#FFFFFF",
    },
  });
