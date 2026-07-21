import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useBusinessProfile } from "@/context/BusinessProfileContext";
import { useColors } from "@/hooks/useColors";
import { CURRENCIES, CurrencyCode, NumberFormat, formatMoney } from "@/utils/currency";

const TERM_PRESETS = ["Net-15", "Net-30", "Net-60", "Due on receipt"];
const TAX_PRESETS = [0, 7, 19];
const NUMBER_FORMATS: { value: NumberFormat; label: string }[] = [
  { value: "comma-dot", label: "1,000.00" },
  { value: "dot-comma", label: "1.000,00" },
];

export default function MyInfoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, loaded, saveProfile } = useBusinessProfile();

  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [address, setAddress] = useState(profile.address);
  const [vatNumber, setVatNumber] = useState(profile.vatNumber);
  const [bankDetails, setBankDetails] = useState(profile.bankDetails);
  const [payLink, setPayLink] = useState(profile.payLink);
  const [logoUri, setLogoUri] = useState(profile.logoUri);
  const [defaultCurrency, setDefaultCurrency] = useState<CurrencyCode>(
    profile.defaultCurrency
  );
  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState(
    profile.defaultPaymentTerms
  );
  const [defaultTaxRate, setDefaultTaxRate] = useState(
    String(profile.defaultTaxRate)
  );
  const [numberFormat, setNumberFormat] = useState<NumberFormat>(
    profile.numberFormat
  );
  const [invoiceNotes, setInvoiceNotes] = useState(profile.invoiceNotes);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  const hydrated = useRef(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate the form once the persisted profile has loaded from storage.
  useEffect(() => {
    if (loaded && !hydrated.current) {
      hydrated.current = true;
      setName(profile.name);
      setEmail(profile.email);
      setAddress(profile.address);
      setVatNumber(profile.vatNumber);
      setBankDetails(profile.bankDetails);
      setPayLink(profile.payLink);
      setLogoUri(profile.logoUri);
      setDefaultCurrency(profile.defaultCurrency);
      setDefaultPaymentTerms(profile.defaultPaymentTerms);
      setDefaultTaxRate(String(profile.defaultTaxRate));
      setNumberFormat(profile.numberFormat);
      setInvoiceNotes(profile.invoiceNotes);
    }
  }, [loaded, profile]);

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  async function pickLogo() {
    if (Platform.OS !== "web") {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          "Please allow photo library access to upload a logo."
        );
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const uri = asset.base64
        ? `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`
        : asset.uri;
      setLogoUri(uri);
    }
  }

  function handleSave() {
    const e: { name?: string; email?: string } = {};
    if (!name.trim()) e.name = "Business name is required";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      e.email = "Enter a valid email address";
    if (Object.keys(e).length > 0) {
      setErrors(e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setErrors({});

    const rate = parseFloat(defaultTaxRate);
    saveProfile({
      name: name.trim(),
      email: email.trim(),
      address: address.trim(),
      vatNumber: vatNumber.trim(),
      bankDetails: bankDetails.trim(),
      payLink: payLink.trim(),
      logoUri,
      defaultCurrency,
      defaultPaymentTerms: defaultPaymentTerms.trim() || "Net-30",
      defaultTaxRate: isNaN(rate) || rate < 0 ? 0 : rate,
      numberFormat,
      invoiceNotes: invoiceNotes.trim(),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2000);
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const s = styles(colors);

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <View style={s.header}>
        <Text style={s.title}>My Info</Text>
        <Text style={s.subtitle}>Appears on your invoices &amp; PDFs</Text>
      </View>

      <KeyboardAwareScrollViewCompat
        showsVerticalScrollIndicator={false}
        bottomOffset={20}
        contentContainerStyle={[
          s.content,
          {
            paddingBottom:
              insets.bottom + (Platform.OS === "web" ? 34 : 0) + 120,
          },
        ]}
      >
        {/* Logo */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Business Logo</Text>
          <View style={s.logoRow}>
            <View style={s.logoPreview}>
              {logoUri ? (
                <Image
                  source={{ uri: logoUri }}
                  style={s.logoImg}
                  contentFit="contain"
                />
              ) : (
                <Feather name="image" size={28} color={colors.mutedForeground} />
              )}
            </View>
            <View style={s.logoActions}>
              <TouchableOpacity
                style={s.logoBtn}
                onPress={pickLogo}
                testID="myinfo-pick-logo"
              >
                <Feather name="upload" size={14} color={colors.primary} />
                <Text style={s.logoBtnText}>
                  {logoUri ? "Change logo" : "Upload logo"}
                </Text>
              </TouchableOpacity>
              {!!logoUri && (
                <TouchableOpacity
                  style={s.logoBtn}
                  onPress={() => setLogoUri("")}
                  testID="myinfo-remove-logo"
                >
                  <Feather name="trash-2" size={14} color={colors.danger} />
                  <Text style={[s.logoBtnText, { color: colors.danger }]}>
                    Remove
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Business details */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Business Details</Text>

          <View style={s.field}>
            <Text style={s.label}>Business / Your Name</Text>
            <TextInput
              style={[s.input, errors.name ? s.inputError : null]}
              placeholder="e.g. Jane Smith Studio"
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={(t) => {
                setName(t);
                if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
              }}
              autoCapitalize="words"
              testID="myinfo-name"
            />
            {!!errors.name && (
              <Text style={s.errorText} testID="myinfo-name-error">
                {errors.name}
              </Text>
            )}
          </View>

          <View style={s.field}>
            <Text style={s.label}>Email</Text>
            <TextInput
              style={[s.input, errors.email ? s.inputError : null]}
              placeholder="e.g. jane@studio.com"
              placeholderTextColor={colors.mutedForeground}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              testID="myinfo-email"
            />
            {!!errors.email && (
              <Text style={s.errorText} testID="myinfo-email-error">
                {errors.email}
              </Text>
            )}
          </View>

          <View style={s.field}>
            <Text style={s.label}>Address</Text>
            <TextInput
              style={[s.input, s.textArea]}
              placeholder="Street, City, Postal code, Country"
              placeholderTextColor={colors.mutedForeground}
              value={address}
              onChangeText={setAddress}
              multiline
              testID="myinfo-address"
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>VAT / Tax Number</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. DE123456789"
              placeholderTextColor={colors.mutedForeground}
              value={vatNumber}
              onChangeText={setVatNumber}
              autoCapitalize="characters"
              testID="myinfo-vat"
            />
          </View>
        </View>

        {/* Payment */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Payment</Text>

          <View style={s.field}>
            <Text style={s.label}>Bank / Payment Details</Text>
            <TextInput
              style={[s.input, s.textArea]}
              placeholder="IBAN, BIC, account name…"
              placeholderTextColor={colors.mutedForeground}
              value={bankDetails}
              onChangeText={setBankDetails}
              multiline
              testID="myinfo-bank"
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Pay Now Link</Text>
            <TextInput
              style={s.input}
              placeholder="https://paypal.me/you or Stripe link"
              placeholderTextColor={colors.mutedForeground}
              value={payLink}
              onChangeText={setPayLink}
              keyboardType="url"
              autoCapitalize="none"
              testID="myinfo-paylink"
            />
            <Text style={s.hint}>
              Shown as a “Pay Now” button on the invoice PDF.
            </Text>
          </View>
        </View>

        {/* Defaults */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Invoice Defaults</Text>

          <View style={s.field}>
            <Text style={s.label}>Default Currency</Text>
            <View style={s.chipWrap}>
              {CURRENCIES.map((c) => {
                const active = defaultCurrency === c.code;
                return (
                  <TouchableOpacity
                    key={c.code}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => setDefaultCurrency(c.code)}
                    testID={`myinfo-currency-${c.code}`}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>
                      {c.symbol} {c.code}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={s.field}>
            <Text style={s.label}>Default Payment Terms</Text>
            <View style={s.chipWrap}>
              {TERM_PRESETS.map((t) => {
                const active = defaultPaymentTerms === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => setDefaultPaymentTerms(t)}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              style={[s.input, { marginTop: 8 }]}
              placeholder="Custom terms"
              placeholderTextColor={colors.mutedForeground}
              value={defaultPaymentTerms}
              onChangeText={setDefaultPaymentTerms}
              testID="myinfo-terms"
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Default Tax Rate (%)</Text>
            <View style={s.chipWrap}>
              {TAX_PRESETS.map((t) => {
                const active = parseFloat(defaultTaxRate) === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => setDefaultTaxRate(String(t))}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>
                      {t}%
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              style={[s.input, { marginTop: 8 }]}
              placeholder="Custom rate"
              placeholderTextColor={colors.mutedForeground}
              value={defaultTaxRate}
              onChangeText={setDefaultTaxRate}
              keyboardType="decimal-pad"
              testID="myinfo-tax"
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Number Format</Text>
            <View style={s.segRow}>
              {NUMBER_FORMATS.map((f) => {
                const active = numberFormat === f.value;
                return (
                  <TouchableOpacity
                    key={f.value}
                    style={[s.segBtn, active && s.segBtnActive]}
                    onPress={() => setNumberFormat(f.value)}
                    testID={`myinfo-format-${f.value}`}
                  >
                    <Text
                      style={[s.segText, active && s.segTextActive]}
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={s.hint}>
              Preview: {formatMoney(1234.5, defaultCurrency, numberFormat)}
            </Text>
          </View>

          <View style={s.field}>
            <Text style={s.label}>Business Notes</Text>
            <TextInput
              style={[s.input, s.textArea]}
              placeholder={
                "e.g. Gemäß §19 UStG wird keine Umsatzsteuer berechnet."
              }
              placeholderTextColor={colors.mutedForeground}
              value={invoiceNotes}
              onChangeText={setInvoiceNotes}
              multiline
              testID="myinfo-invoice-notes"
            />
            <Text style={s.hint}>
              Appears at the bottom of every invoice PDF and pre-fills the
              notes field on new invoices — you can still edit it per invoice.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[s.saveBtn, saved && s.saveBtnSaved]}
          onPress={handleSave}
          testID="myinfo-save"
        >
          <Feather name={saved ? "check" : "save"} size={16} color="#fff" />
          <Text style={s.saveBtnText}>{saved ? "Saved" : "Save"}</Text>
        </TouchableOpacity>
      </KeyboardAwareScrollViewCompat>
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
    content: {
      paddingHorizontal: 16,
      gap: 22,
    },
    section: {
      gap: 12,
    },
    sectionTitle: {
      fontSize: 15,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    logoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
    },
    logoPreview: {
      width: 72,
      height: 72,
      borderRadius: 12,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
    },
    logoImg: {
      width: "100%",
      height: "100%",
    },
    logoActions: {
      flex: 1,
      gap: 8,
    },
    logoBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.muted,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    logoBtnText: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      color: colors.primary,
    },
    field: {
      gap: 6,
    },
    label: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    input: {
      backgroundColor: colors.card,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    textArea: {
      minHeight: 72,
      textAlignVertical: "top",
    },
    inputError: {
      borderColor: colors.danger,
    },
    errorText: {
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      color: colors.danger,
      marginTop: 4,
    },
    hint: {
      fontSize: 11,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    chipWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    chip: {
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.border,
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
    segRow: {
      flexDirection: "row",
      gap: 8,
    },
    segBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: "center",
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    segBtnActive: {
      borderColor: colors.primary,
      backgroundColor: colors.successBg,
    },
    segText: {
      fontSize: 15,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
    },
    segTextActive: {
      color: colors.primary,
      fontFamily: "Inter_700Bold",
    },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 4,
    },
    saveBtnSaved: {
      backgroundColor: colors.success,
    },
    saveBtnText: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
      color: "#FFFFFF",
    },
  });
