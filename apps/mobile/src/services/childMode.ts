import * as SecureStore from "expo-secure-store";

const ACTIVE_CHILD_KEY = "adaptive-kids.active-child-id";

export function getPersistedActiveChildId(): Promise<string | null> {
  return SecureStore.getItemAsync(ACTIVE_CHILD_KEY);
}

export function persistActiveChildId(childId: string): Promise<void> {
  return SecureStore.setItemAsync(ACTIVE_CHILD_KEY, childId, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export function clearPersistedActiveChildId(): Promise<void> {
  return SecureStore.deleteItemAsync(ACTIVE_CHILD_KEY);
}
