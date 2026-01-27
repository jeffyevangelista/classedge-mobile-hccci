import AsyncStorage from "@react-native-async-storage/async-storage";

export const getASItem = async <T>(key: string): Promise<T | null> => {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.log(`Error getting item with key ${key} from AsyncStorage`, error);
    return null;
  }
};

export const setASItem = async (key: string, value: unknown) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    console.log(`Item with key ${key} set in AsyncStorage`);
  } catch (error) {
    console.log(`Error setting item with key ${key} in AsyncStorage`, error);
  }
};

export const deleteASItem = async (key: string) => {
  try {
    await AsyncStorage.removeItem(key);
    console.log(`Item with key ${key} removed from AsyncStorage`);
  } catch (error) {
    console.log(`Error removing item with key ${key} from AsyncStorage`, error);
  }
};
