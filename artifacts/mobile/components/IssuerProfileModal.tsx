import { Feather } from "@expo/vector-icons";
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
import { IssuerProfile } from "@/hooks/useIssuerProfile";

interface Props {
  visible: boolean;
  initial: IssuerProfile;
  onSave: (p: IssuerProfile) => void;
  onCancel: () => void;
  title?: string;
}

export default function IssuerProfileModal({
  visible,
  initial,
  onSave,
  onCancel,
  title = "Your Details",
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);

  useEffect(() => {
    if (visible) {
      setName(initial.name);
      setEmail(initial.email);
    }
  }, [visible, initial]);

  function handleSave() {
    onSave({ name: name.trim(), email: email.trim() });
  }

  const s = styles(colors);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={s.overlay} onPress={onCancel}>
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
                <Feather name="user" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{title}</Text>
                <Text style={s.subtitle}>
                  This appears on your exported PDF invoices
                </Text>
              </View>
              <TouchableOpacity onPress={onCancel} style={s.closeBtn}>
                <Feather name="x" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <View style={s.field}>
              <Text style={s.label}>Your Name</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Jane Smith"
                placeholderTextColor={colors.mutedForeground}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>Your Email</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. jane@studio.com"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
              <Feather name="download" size={16} color="#fff" />
              <Text style={s.saveBtnText}>Generate PDF</Text>
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
      marginBottom: 20,
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
    field: { marginBottom: 14 },
    label: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    input: {
      backgroundColor: colors.muted,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 15,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 4,
    },
    saveBtnText: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
      color: "#FFFFFF",
    },
  });
