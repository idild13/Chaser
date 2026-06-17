import { Alert, Platform } from "react-native";

export function confirmAction(opts: {
  title: string;
  message: string;
  confirmText?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  const {
    title,
    message,
    confirmText = "Confirm",
    destructive = false,
    onConfirm,
  } = opts;

  if (Platform.OS === "web") {
    const ok =
      typeof window !== "undefined"
        ? window.confirm(`${title}\n\n${message}`)
        : true;
    if (ok) onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    {
      text: confirmText,
      style: destructive ? "destructive" : "default",
      onPress: onConfirm,
    },
  ]);
}
