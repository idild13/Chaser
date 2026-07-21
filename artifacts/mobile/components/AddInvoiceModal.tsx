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
import {
  computeInvoiceTotals,
  DiscountType,
  Invoice,
  InvoiceDraft,
  InvoiceStatus,
  LineItem,
  useInvoices,
} from "@/context/InvoicesContext";
import { useBusinessProfile } from "@/context/BusinessProfileContext";
import {
  CURRENCIES,
  CurrencyCode,
  currencySymbol,
  formatMoney,
} from "@/utils/currency";
import { formatDisplayDate, parseDisplayDate } from "@/utils/date";

interface Props {
  visible: boolean;
  onClose: () => void;
  editInvoice?: Invoice | null;
  onSaved?: () => void;
}

interface LineItemInput {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

type TaxMode = "0" | "7" | "19" | "custom";
type TermMode = "Net-15" | "Net-30" | "custom";

function genLocalId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function emptyLine(): LineItemInput {
  return { id: genLocalId(), description: "", quantity: "1", unitPrice: "" };
}

function initialTaxMode(rate: number): TaxMode {
  if (rate === 0) return "0";
  if (rate === 7) return "7";
  if (rate === 19) return "19";
  return "custom";
}

function initialTermMode(term: string): TermMode {
  if (term === "Net-15") return "Net-15";
  if (term === "Net-30") return "Net-30";
  return "custom";
}

export default function AddInvoiceModal({
  visible,
  onClose,
  editInvoice,
  onSaved,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addInvoice, updateInvoice, nextInvNum } = useInvoices();
  const { profile } = useBusinessProfile();
  const isEdit = !!editInvoice;

  const [client, setClient] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientStreet, setClientStreet] = useState("");
  const [clientCity, setClientCity] = useState("");
  const [clientPostcode, setClientPostcode] = useState("");
  const [clientCountry, setClientCountry] = useState("");
  const [invnum, setInvnum] = useState(nextInvNum);
  const [poNumber, setPoNumber] = useState("");
  const [due, setDue] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("EUR");
  const [lineItems, setLineItems] = useState<LineItemInput[]>([emptyLine()]);
  const [taxMode, setTaxMode] = useState<TaxMode>("0");
  const [taxCustom, setTaxCustom] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [termMode, setTermMode] = useState<TermMode>("Net-30");
  const [termCustom, setTermCustom] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [status, setStatus] = useState<InvoiceStatus>("pending");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      if (editInvoice) {
        setInvnum(editInvoice.invnum);
        setClient(editInvoice.client);
        setClientEmail(editInvoice.clientEmail ?? "");
        // Legacy invoices only have the single-field clientAddress; surface it
        // in the street field so nothing is lost when re-saving.
        setClientStreet(
          editInvoice.clientStreet ?? editInvoice.clientAddress ?? ""
        );
        setClientCity(editInvoice.clientCity ?? "");
        setClientPostcode(editInvoice.clientPostcode ?? "");
        setClientCountry(editInvoice.clientCountry ?? "");
        setPoNumber(editInvoice.poNumber ?? "");
        setLineItems(
          editInvoice.lineItems && editInvoice.lineItems.length > 0
            ? editInvoice.lineItems.map((li) => ({
                id: li.id,
                description: li.description,
                quantity: String(li.quantity),
                unitPrice: String(li.unitPrice),
              }))
            : [emptyLine()]
        );
        setCurrency(editInvoice.currency);
        const etr = Number(editInvoice.taxRate) || 0;
        const etm = initialTaxMode(etr);
        setTaxMode(etm);
        setTaxCustom(etm === "custom" ? String(etr) : "");
        setDiscountType(editInvoice.discountType ?? "percent");
        setDiscountValue(
          editInvoice.discountValue && editInvoice.discountValue > 0
            ? String(editInvoice.discountValue)
            : ""
        );
        const ept = editInvoice.paymentTerms || "Net-30";
        const eptm = initialTermMode(ept);
        setTermMode(eptm);
        setTermCustom(eptm === "custom" ? ept : "");
        setPaymentNotes(editInvoice.paymentNotes ?? "");
        setStatus(editInvoice.status);
        setDue(formatDisplayDate(editInvoice.due));
        setErrors({});
      } else {
        setInvnum(nextInvNum);
        setClient("");
        setClientEmail("");
        setClientStreet("");
        setClientCity("");
        setClientPostcode("");
        setClientCountry("");
        setPoNumber("");
        setLineItems([emptyLine()]);
        setDiscountType("percent");
        setDiscountValue("");
        // Business-wide notes (My Info) pre-fill the per-invoice notes so
        // legal notices appear on every invoice but stay editable per invoice.
        setPaymentNotes(profile.invoiceNotes ?? "");
        setStatus("pending");
        setErrors({});

        setCurrency(profile.defaultCurrency || "EUR");

        const tr = Number(profile.defaultTaxRate) || 0;
        const tm = initialTaxMode(tr);
        setTaxMode(tm);
        setTaxCustom(tm === "custom" ? String(tr) : "");

        const pt = profile.defaultPaymentTerms || "Net-30";
        const ptm = initialTermMode(pt);
        setTermMode(ptm);
        setTermCustom(ptm === "custom" ? pt : "");

        const defaultDue = new Date();
        defaultDue.setDate(defaultDue.getDate() + 30);
        setDue(formatDisplayDate(defaultDue.toISOString().split("T")[0]));
      }

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
  }, [visible, nextInvNum, profile, editInvoice]);

  const effectiveTaxRate =
    taxMode === "custom" ? parseFloat(taxCustom) || 0 : Number(taxMode);
  const effectiveTerms =
    termMode === "custom" ? termCustom.trim() : termMode;
  const issueDate = editInvoice?.createdAt
    ? formatDisplayDate(editInvoice.createdAt)
    : "";
  const lockCurrency = isEdit && (editInvoice?.amountPaid ?? 0) > 0;

  function numericLineItems(): LineItem[] {
    return lineItems.map((li) => ({
      id: li.id,
      description: li.description.trim(),
      quantity: parseFloat(li.quantity) || 0,
      unitPrice: parseFloat(li.unitPrice) || 0,
    }));
  }

  function buildDraft(): InvoiceDraft {
    const items = numericLineItems().filter(
      (li) => li.description !== "" || li.unitPrice > 0
    );
    const draft: InvoiceDraft = {
      client: client.trim(),
      invnum: invnum.trim() || nextInvNum,
      lineItems: items.length > 0 ? items : numericLineItems(),
      currency,
      taxRate: effectiveTaxRate,
      // The form shows DD/MM/YYYY; storage stays ISO (YYYY-MM-DD).
      due: parseDisplayDate(due) ?? "",
      status,
    };
    if (clientEmail.trim()) draft.clientEmail = clientEmail.trim();
    if (clientStreet.trim()) draft.clientStreet = clientStreet.trim();
    if (clientCity.trim()) draft.clientCity = clientCity.trim();
    if (clientPostcode.trim()) draft.clientPostcode = clientPostcode.trim();
    if (clientCountry.trim()) draft.clientCountry = clientCountry.trim();
    if (poNumber.trim()) draft.poNumber = poNumber.trim();
    const dv = parseFloat(discountValue) || 0;
    if (dv > 0) {
      draft.discountType = discountType;
      draft.discountValue = dv;
    }
    if (effectiveTerms) draft.paymentTerms = effectiveTerms;
    if (paymentNotes.trim()) draft.paymentNotes = paymentNotes.trim();
    return draft;
  }

  const previewTotals = computeInvoiceTotals({
    ...buildDraft(),
    id: "preview",
    createdAt: "",
  } as Invoice);

  function validate() {
    const e: Record<string, string> = {};
    if (!client.trim()) e.client = "Client name is required";

    const items = numericLineItems();
    const anyValid = items.some(
      (li) => li.description !== "" && li.quantity > 0 && li.unitPrice > 0
    );
    if (!anyValid)
      e.lineItems = "Add at least one line item with description, qty and price";

    if (!due.trim()) e.due = "Due date is required";
    else if (!parseDisplayDate(due)) e.due = "Format: DD/MM/YYYY";

    if (
      clientEmail.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim())
    )
      e.clientEmail = "Enter a valid email";

    if (taxMode === "custom" && taxCustom.trim()) {
      const t = parseFloat(taxCustom);
      if (isNaN(t) || t < 0) e.tax = "Invalid tax rate";
    }

    if (discountValue.trim()) {
      const dv = parseFloat(discountValue);
      if (isNaN(dv) || dv < 0) e.discount = "Invalid discount";
    }

    return e;
  }

  function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    const draft = buildDraft();
    const totals = computeInvoiceTotals({
      ...draft,
      id: "x",
      createdAt: "",
    } as Invoice);

    if (editInvoice) {
      const dv = parseFloat(discountValue) || 0;
      const newPaid = Math.min(editInvoice.amountPaid ?? 0, totals.total);
      const stillPaid = totals.total > 0 && newPaid >= totals.total - 0.005;
      const patch: Partial<Invoice> = {
        client: client.trim(),
        clientEmail: clientEmail.trim() || undefined,
        // The structured fields replace the legacy single-field address.
        clientAddress: undefined,
        clientStreet: clientStreet.trim() || undefined,
        clientCity: clientCity.trim() || undefined,
        clientPostcode: clientPostcode.trim() || undefined,
        clientCountry: clientCountry.trim() || undefined,
        poNumber: poNumber.trim() || undefined,
        lineItems: draft.lineItems,
        currency,
        taxRate: effectiveTaxRate,
        discountType: dv > 0 ? discountType : undefined,
        discountValue: dv > 0 ? dv : undefined,
        paymentTerms: effectiveTerms || undefined,
        paymentNotes: paymentNotes.trim() || undefined,
        due: parseDisplayDate(due) ?? due,
        amountPaid: newPaid,
        paidAt: stillPaid
          ? editInvoice.paidAt ?? new Date().toISOString()
          : undefined,
      };
      updateInvoice(editInvoice.id, patch);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved?.();
      onClose();
      return;
    }

    if (status === "paid") {
      draft.amountPaid = totals.total;
      draft.paidAt = new Date().toISOString();
    } else {
      draft.amountPaid = 0;
    }
    addInvoice(draft);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  }

  function updateLineItem(
    id: string,
    field: keyof Omit<LineItemInput, "id">,
    value: string
  ) {
    setLineItems((prev) =>
      prev.map((li) => (li.id === id ? { ...li, [field]: value } : li))
    );
    setErrors((e) => ({ ...e, lineItems: "" }));
  }

  function addLine() {
    setLineItems((prev) => [...prev, emptyLine()]);
  }

  function removeLine(id: string) {
    setLineItems((prev) =>
      prev.length > 1 ? prev.filter((li) => li.id !== id) : prev
    );
  }

  const statusOptions: { value: InvoiceStatus; label: string }[] = [
    { value: "pending", label: "Pending" },
    { value: "paid", label: "Paid" },
    { value: "overdue", label: "Overdue" },
  ];

  const taxOptions: { value: TaxMode; label: string }[] = [
    { value: "0", label: "0%" },
    { value: "7", label: "7%" },
    { value: "19", label: "19%" },
    { value: "custom", label: "Custom" },
  ];

  const termOptions: { value: TermMode; label: string }[] = [
    { value: "Net-15", label: "Net-15" },
    { value: "Net-30", label: "Net-30" },
    { value: "custom", label: "Custom" },
  ];

  const symbol = currencySymbol(currency);
  const fmt = (n: number) => formatMoney(n, currency, profile.numberFormat);
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
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={s.sheetInner}
            >
              <View style={s.handle} />

              <View style={s.header}>
                <Text style={s.title}>
                  {isEdit ? "Edit Invoice" : "New Invoice"}
                </Text>
                <TouchableOpacity onPress={onClose} style={s.closeBtn}>
                  <Feather name="x" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={s.scrollBody}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={s.scrollContent}
              >
                {/* Client */}
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
                    <View style={s.lockLabelRow}>
                      <Text style={[s.label, { marginBottom: 0 }]}>Invoice #</Text>
                      {isEdit && (
                        <Feather
                          name="lock"
                          size={11}
                          color={colors.mutedForeground}
                        />
                      )}
                    </View>
                    <TextInput
                      style={[s.input, isEdit && s.inputLocked]}
                      placeholder={nextInvNum}
                      placeholderTextColor={colors.mutedForeground}
                      value={invnum}
                      onChangeText={setInvnum}
                      autoCapitalize="characters"
                      editable={!isEdit}
                    />
                  </View>
                </View>

                {isEdit && (
                  <View style={s.field}>
                    <View style={s.lockLabelRow}>
                      <Text style={[s.label, { marginBottom: 0 }]}>
                        Issue Date
                      </Text>
                      <Feather
                        name="lock"
                        size={11}
                        color={colors.mutedForeground}
                      />
                    </View>
                    <TextInput
                      style={[s.input, s.inputLocked]}
                      value={issueDate}
                      editable={false}
                    />
                  </View>
                )}

                <View style={s.field}>
                  <Text style={s.label}>Client Email (optional)</Text>
                  <TextInput
                    style={[s.input, errors.clientEmail ? s.inputError : null]}
                    placeholder="e.g. billing@acme.com"
                    placeholderTextColor={colors.mutedForeground}
                    value={clientEmail}
                    onChangeText={(t) => {
                      setClientEmail(t);
                      setErrors((e) => ({ ...e, clientEmail: "" }));
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  {!!errors.clientEmail && (
                    <Text style={s.errorText}>{errors.clientEmail}</Text>
                  )}
                </View>

                <View style={s.field}>
                  <Text style={s.label}>Client Address (optional)</Text>
                  <TextInput
                    style={s.input}
                    placeholder="Street and number"
                    placeholderTextColor={colors.mutedForeground}
                    value={clientStreet}
                    onChangeText={setClientStreet}
                  />
                  <View style={[s.row, { marginTop: 8 }]}>
                    <TextInput
                      style={[s.input, { flex: 1 }]}
                      placeholder="Postcode"
                      placeholderTextColor={colors.mutedForeground}
                      value={clientPostcode}
                      onChangeText={setClientPostcode}
                    />
                    <TextInput
                      style={[s.input, { flex: 2 }]}
                      placeholder="City"
                      placeholderTextColor={colors.mutedForeground}
                      value={clientCity}
                      onChangeText={setClientCity}
                    />
                  </View>
                  <TextInput
                    style={[s.input, { marginTop: 8 }]}
                    placeholder="Country"
                    placeholderTextColor={colors.mutedForeground}
                    value={clientCountry}
                    onChangeText={setClientCountry}
                  />
                </View>

                <View style={s.row}>
                  <View style={[s.field, { flex: 1 }]}>
                    <Text style={s.label}>PO Number (optional)</Text>
                    <TextInput
                      style={s.input}
                      placeholder="e.g. PO-1024"
                      placeholderTextColor={colors.mutedForeground}
                      value={poNumber}
                      onChangeText={setPoNumber}
                      autoCapitalize="characters"
                    />
                  </View>
                  <View style={[s.field, { flex: 1 }]}>
                    <Text style={s.label}>Due Date</Text>
                    <TextInput
                      style={[s.input, errors.due ? s.inputError : null]}
                      placeholder="DD/MM/YYYY"
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

                {/* Currency */}
                <View style={s.field}>
                  <Text style={s.label}>Currency</Text>
                  <View style={s.chipWrap}>
                    {CURRENCIES.map((c) => (
                      <TouchableOpacity
                        key={c.code}
                        style={[
                          s.chip,
                          currency === c.code && s.chipActive,
                          lockCurrency && currency !== c.code && s.chipDisabled,
                        ]}
                        onPress={() => {
                          if (!lockCurrency) setCurrency(c.code);
                        }}
                        disabled={lockCurrency}
                      >
                        <Text
                          style={[
                            s.chipText,
                            currency === c.code && s.chipTextActive,
                          ]}
                        >
                          {c.symbol} {c.code}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {lockCurrency && (
                    <Text style={s.lockHint}>
                      Currency is locked because a payment has been recorded.
                    </Text>
                  )}
                </View>

                {/* Line items */}
                <View style={s.field}>
                  <View style={s.sectionHeader}>
                    <Text style={s.label}>Line Items</Text>
                    <TouchableOpacity style={s.addLineBtn} onPress={addLine}>
                      <Feather name="plus" size={14} color={colors.primary} />
                      <Text style={s.addLineBtnText}>Add</Text>
                    </TouchableOpacity>
                  </View>

                  {lineItems.map((li, idx) => {
                    const lineSub =
                      (parseFloat(li.quantity) || 0) *
                      (parseFloat(li.unitPrice) || 0);
                    return (
                      <View key={li.id} style={s.lineCard}>
                        <View style={s.lineTopRow}>
                          <Text style={s.lineIndex}>#{idx + 1}</Text>
                          {lineItems.length > 1 && (
                            <TouchableOpacity
                              onPress={() => removeLine(li.id)}
                              style={s.lineRemove}
                            >
                              <Feather
                                name="trash-2"
                                size={14}
                                color={colors.danger}
                              />
                            </TouchableOpacity>
                          )}
                        </View>
                        <TextInput
                          style={[s.input, s.lineDesc]}
                          placeholder="Description"
                          placeholderTextColor={colors.mutedForeground}
                          value={li.description}
                          onChangeText={(t) =>
                            updateLineItem(li.id, "description", t)
                          }
                        />
                        <View style={s.lineNumRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.miniLabel}>Qty</Text>
                            <TextInput
                              style={s.input}
                              placeholder="1"
                              placeholderTextColor={colors.mutedForeground}
                              value={li.quantity}
                              onChangeText={(t) =>
                                updateLineItem(li.id, "quantity", t)
                              }
                              keyboardType="decimal-pad"
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.miniLabel}>
                              Unit Price ({symbol})
                            </Text>
                            <TextInput
                              style={s.input}
                              placeholder="0.00"
                              placeholderTextColor={colors.mutedForeground}
                              value={li.unitPrice}
                              onChangeText={(t) =>
                                updateLineItem(li.id, "unitPrice", t)
                              }
                              keyboardType="decimal-pad"
                            />
                          </View>
                        </View>
                        <View style={s.lineSubRow}>
                          <Text style={s.lineSubLabel}>Subtotal</Text>
                          <Text style={s.lineSubValue}>{fmt(lineSub)}</Text>
                        </View>
                      </View>
                    );
                  })}
                  {!!errors.lineItems && (
                    <Text style={s.errorText}>{errors.lineItems}</Text>
                  )}
                </View>

                {/* Tax */}
                <View style={s.field}>
                  <Text style={s.label}>Tax Rate</Text>
                  <View style={s.chipWrap}>
                    {taxOptions.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          s.chip,
                          taxMode === opt.value && s.chipActive,
                        ]}
                        onPress={() => {
                          setTaxMode(opt.value);
                          setErrors((e) => ({ ...e, tax: "" }));
                        }}
                      >
                        <Text
                          style={[
                            s.chipText,
                            taxMode === opt.value && s.chipTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {taxMode === "custom" && (
                    <TextInput
                      style={[
                        s.input,
                        { marginTop: 8 },
                        errors.tax ? s.inputError : null,
                      ]}
                      placeholder="Tax rate (%)"
                      placeholderTextColor={colors.mutedForeground}
                      value={taxCustom}
                      onChangeText={(t) => {
                        setTaxCustom(t);
                        setErrors((e) => ({ ...e, tax: "" }));
                      }}
                      keyboardType="decimal-pad"
                    />
                  )}
                  {!!errors.tax && (
                    <Text style={s.errorText}>{errors.tax}</Text>
                  )}
                </View>

                {/* Discount */}
                <View style={s.field}>
                  <Text style={s.label}>Discount (optional)</Text>
                  <View style={s.discountRow}>
                    <View style={s.toggleGroup}>
                      <TouchableOpacity
                        style={[
                          s.toggleBtn,
                          discountType === "percent" && s.toggleBtnActive,
                        ]}
                        onPress={() => setDiscountType("percent")}
                      >
                        <Text
                          style={[
                            s.toggleText,
                            discountType === "percent" && s.toggleTextActive,
                          ]}
                        >
                          %
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          s.toggleBtn,
                          discountType === "fixed" && s.toggleBtnActive,
                        ]}
                        onPress={() => setDiscountType("fixed")}
                      >
                        <Text
                          style={[
                            s.toggleText,
                            discountType === "fixed" && s.toggleTextActive,
                          ]}
                        >
                          {symbol}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={[
                        s.input,
                        { flex: 1 },
                        errors.discount ? s.inputError : null,
                      ]}
                      placeholder={
                        discountType === "percent" ? "e.g. 10" : "e.g. 50"
                      }
                      placeholderTextColor={colors.mutedForeground}
                      value={discountValue}
                      onChangeText={(t) => {
                        setDiscountValue(t);
                        setErrors((e) => ({ ...e, discount: "" }));
                      }}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  {!!errors.discount && (
                    <Text style={s.errorText}>{errors.discount}</Text>
                  )}
                </View>

                {/* Payment terms */}
                <View style={s.field}>
                  <Text style={s.label}>Payment Terms</Text>
                  <View style={s.chipWrap}>
                    {termOptions.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          s.chip,
                          termMode === opt.value && s.chipActive,
                        ]}
                        onPress={() => setTermMode(opt.value)}
                      >
                        <Text
                          style={[
                            s.chipText,
                            termMode === opt.value && s.chipTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {termMode === "custom" && (
                    <TextInput
                      style={[s.input, { marginTop: 8 }]}
                      placeholder="e.g. Due on receipt"
                      placeholderTextColor={colors.mutedForeground}
                      value={termCustom}
                      onChangeText={setTermCustom}
                    />
                  )}
                </View>

                {/* Notes (prefilled from My Info Business Notes) */}
                <View style={s.field}>
                  <Text style={s.label}>Notes (optional)</Text>
                  <TextInput
                    style={[s.input, s.textArea]}
                    placeholder="Shown at the bottom of the PDF — prefilled from My Info Business Notes"
                    placeholderTextColor={colors.mutedForeground}
                    value={paymentNotes}
                    onChangeText={setPaymentNotes}
                    multiline
                    numberOfLines={2}
                  />
                </View>

                {/* Status */}
                {!isEdit && (
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
                )}

                {/* Totals preview */}
                <View style={s.totalsBox}>
                  <View style={s.totalRow}>
                    <Text style={s.totalLabel}>Subtotal</Text>
                    <Text style={s.totalValue}>
                      {fmt(previewTotals.subtotal)}
                    </Text>
                  </View>
                  {previewTotals.discount > 0 && (
                    <View style={s.totalRow}>
                      <Text style={s.totalLabel}>Discount</Text>
                      <Text style={s.totalValue}>
                        −{fmt(previewTotals.discount)}
                      </Text>
                    </View>
                  )}
                  {effectiveTaxRate > 0 && (
                    <View style={s.totalRow}>
                      <Text style={s.totalLabel}>
                        Tax ({effectiveTaxRate}%)
                      </Text>
                      <Text style={s.totalValue}>{fmt(previewTotals.tax)}</Text>
                    </View>
                  )}
                  <View style={s.totalDivider} />
                  <View style={s.totalRow}>
                    <Text style={s.grandLabel}>Total</Text>
                    <Text style={s.grandValue}>{fmt(previewTotals.total)}</Text>
                  </View>
                </View>

                <TouchableOpacity style={s.addBtn} onPress={handleSubmit}>
                  <Text style={s.addBtnText}>
                    {isEdit ? "Save Changes" : "Add Invoice"}
                  </Text>
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
      flex: 1,
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
    sheetInner: {
      flexShrink: 1,
    },
    scrollBody: {
      flexShrink: 1,
    },
    scrollContent: {
      paddingBottom: 16,
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
    miniLabel: {
      fontSize: 11,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
      marginBottom: 4,
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
    inputLocked: {
      backgroundColor: colors.background,
      color: colors.mutedForeground,
      borderColor: colors.border,
    },
    lockLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginBottom: 6,
    },
    chipDisabled: {
      opacity: 0.4,
    },
    lockHint: {
      fontSize: 11,
      color: colors.mutedForeground,
      marginTop: 6,
      fontFamily: "Inter_400Regular",
    },
    errorText: {
      fontSize: 11,
      color: colors.danger,
      marginTop: 4,
      fontFamily: "Inter_400Regular",
    },
    chipWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: colors.muted,
      borderWidth: 1.5,
      borderColor: "transparent",
    },
    chipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.successBg,
    },
    chipText: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
    },
    chipTextActive: {
      color: colors.primary,
      fontFamily: "Inter_600SemiBold",
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    addLineBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 8,
      backgroundColor: colors.successBg,
    },
    addLineBtnText: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.primary,
    },
    lineCard: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 12,
      marginTop: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    lineTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    lineIndex: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
    },
    lineRemove: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.dangerBg,
      alignItems: "center",
      justifyContent: "center",
    },
    lineDesc: {
      marginBottom: 10,
    },
    lineNumRow: {
      flexDirection: "row",
      gap: 10,
    },
    lineSubRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 10,
    },
    lineSubLabel: {
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
    },
    lineSubValue: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    discountRow: {
      flexDirection: "row",
      gap: 10,
      alignItems: "center",
    },
    toggleGroup: {
      flexDirection: "row",
      borderRadius: 10,
      backgroundColor: colors.muted,
      padding: 3,
      gap: 3,
    },
    toggleBtn: {
      width: 44,
      paddingVertical: 9,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    toggleBtnActive: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    toggleText: {
      fontSize: 14,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
    },
    toggleTextActive: {
      color: colors.primary,
      fontFamily: "Inter_700Bold",
    },
    totalsBox: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 14,
      marginTop: 4,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    totalRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 3,
    },
    totalLabel: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    totalValue: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
    },
    totalDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 8,
    },
    grandLabel: {
      fontSize: 15,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    grandValue: {
      fontSize: 17,
      fontFamily: "Inter_700Bold",
      color: colors.primary,
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
