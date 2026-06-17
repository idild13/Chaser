import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const CHUNK_SIZE = 1900;

function chunkKey(key: string, index: number): string {
  return `${key}__chunk_${index}`;
}
function countKey(key: string): string {
  return `${key}__count`;
}

export async function secureGet(key: string): Promise<string | null> {
  const countStr = await SecureStore.getItemAsync(countKey(key));
  if (countStr === null) return null;

  const count = parseInt(countStr, 10);
  if (isNaN(count) || count < 0) return null;
  if (count === 0) return "";

  const chunks = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      SecureStore.getItemAsync(chunkKey(key, i))
    )
  );

  if (chunks.some((c) => c === null)) return null;
  return (chunks as string[]).join("");
}

export async function secureSet(key: string, value: string): Promise<void> {
  const oldCountStr = await SecureStore.getItemAsync(countKey(key));
  const oldCount =
    oldCountStr !== null ? parseInt(oldCountStr, 10) : 0;

  const parts: string[] = [];
  for (let i = 0; i < value.length; i += CHUNK_SIZE) {
    parts.push(value.slice(i, i + CHUNK_SIZE));
  }

  await SecureStore.setItemAsync(countKey(key), String(parts.length));
  await Promise.all(
    parts.map((chunk, i) => SecureStore.setItemAsync(chunkKey(key, i), chunk))
  );

  if (!isNaN(oldCount) && oldCount > parts.length) {
    await Promise.all(
      Array.from({ length: oldCount - parts.length }, (_, i) =>
        SecureStore.deleteItemAsync(chunkKey(key, parts.length + i))
      )
    );
  }
}

export async function secureDelete(key: string): Promise<void> {
  const countStr = await SecureStore.getItemAsync(countKey(key));
  const count = countStr !== null ? parseInt(countStr, 10) : 0;
  if (!isNaN(count) && count > 0) {
    await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.deleteItemAsync(chunkKey(key, i))
      )
    );
  }
  await SecureStore.deleteItemAsync(countKey(key));
}

export async function migrateFromAsyncStorage(
  asyncStorageKey: string,
  secureKey: string
): Promise<string | null> {
  const existing = await secureGet(secureKey);
  if (existing !== null) return existing;

  const raw = await AsyncStorage.getItem(asyncStorageKey);
  if (raw !== null) {
    await secureSet(secureKey, raw);
    await AsyncStorage.removeItem(asyncStorageKey);
  }
  return raw;
}
