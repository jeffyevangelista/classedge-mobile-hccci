import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Persister,
  PersistQueryClientOptions,
} from "@tanstack/react-query-persist-client";

export const createAsyncStoragePersister = (): Persister => {
  return {
    persistClient: async (client) => {
      try {
        await AsyncStorage.setItem("reactQueryCache", JSON.stringify(client));
      } catch (error) {
        console.error("Failed to persist query client:", error);
      }
    },
    restoreClient: async () => {
      try {
        const cache = await AsyncStorage.getItem("reactQueryCache");
        return cache ? JSON.parse(cache) : undefined;
      } catch (error) {
        console.error("Failed to restore query client:", error);
        return undefined;
      }
    },
    removeClient: async () => {
      try {
        await AsyncStorage.removeItem("reactQueryCache");
      } catch (error) {
        console.error("Failed to remove query client:", error);
      }
    },
  };
};
