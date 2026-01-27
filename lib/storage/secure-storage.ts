import { deleteItemAsync, getItemAsync, setItemAsync } from "expo-secure-store";

export const getSSItem = async (key: string): Promise<string | null> => {
  try {
    const value = await getItemAsync(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.log(
      `Error getting item with key ${key} from secure storage`,
      error,
    );
    return null;
  }
};

export const setSSItem = async (key: string, value: unknown): Promise<void> => {
  try {
    await setItemAsync(key, JSON.stringify(value));
    console.log(`Item with key ${key} set in secure storage`);
  } catch (error) {
    console.log(`Error saving item with key ${key} to secure storage`, error);
  }
};

export const deleteSSItem = async (key: string): Promise<void> => {
  try {
    await deleteItemAsync(key);
    console.log(
      `Item with key ${key} deleted successfully from secure storage`,
    );
  } catch (error) {
    console.log(
      `Error deleting item with key ${key} from secure storage`,
      error,
    );
  }
};
