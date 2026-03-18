import { storage } from "./mmkvPersister";

export const getMMKVItem = <T>(key: string): T | null => {
  try {
    const value = storage.getString(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.log(`Error getting item with key ${key} from MMKV`, error);
    return null;
  }
};

export const setMMKVItem = (key: string, value: unknown): void => {
  try {
    storage.set(key, JSON.stringify(value));
  } catch (error) {
    console.log(`Error setting item with key ${key} in MMKV`, error);
  }
};

export const deleteMMKVItem = (key: string): void => {
  try {
    storage.remove(key);
  } catch (error) {
    console.log(`Error deleting item with key ${key} from MMKV`, error);
  }
};
