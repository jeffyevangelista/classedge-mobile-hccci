import {
  Persister,
  PersistQueryClientOptions,
} from "@tanstack/react-query-persist-client";
import { createMMKV } from "react-native-mmkv";

// Initialize MMKV
export const storage = createMMKV();

// Create the custom persister
export const createMmkvPersister = (): Persister => {
  return {
    persistClient: (client) => {
      storage.set("reactQueryCache", JSON.stringify(client));
    },
    restoreClient: () => {
      const cache = storage.getString("reactQueryCache");
      return cache ? JSON.parse(cache) : undefined;
    },
    removeClient: () => {
      storage.remove("reactQueryCache");
    },
  };
};
