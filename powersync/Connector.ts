import { env } from "@/utils/env";
import useStore from "@/lib/store";
import {
  type AbstractPowerSyncDatabase,
  type PowerSyncBackendConnector,
  UpdateType,
} from "@powersync/react-native";
import { createBaseLogger, LogLevel } from "@powersync/react-native";

// const logger = createBaseLogger();
// logger.useDefaults(); // Console output
// logger.setLevel(LogLevel.DEBUG);

export class Connector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    const { powersyncToken } = useStore.getState();

    return {
      endpoint: env.EXPO_PUBLIC_POWERSYNC_ENDPOINT,
      token: powersyncToken ?? "",
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase) {
    /**
     * For batched crud transactions, use data.getCrudBatch(n);
     * https://powersync-ja.github.io/powersync-js/react-native-sdk/classes/SqliteBucketStorage#getcrudbatch
     */
    const transaction = await database.getNextCrudTransaction();

    if (!transaction) {
      return;
    }

    const { accessToken, isConnected, isInternetReachable } =
      useStore.getState();

    // Skip upload when offline — transaction stays in the local queue
    // and will be retried when PowerSync reconnects.
    if (!isConnected || !isInternetReachable) {
      throw new Error("Offline: upload deferred until reconnected");
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    try {
      for (const op of transaction.crud) {
        // op.opData contains the columns (name, etc.)
        // op.id is the automatically managed 'id' column
        const record = { ...op.opData, id: Number(op.id) };

        switch (op.op) {
          case UpdateType.PUT:
            // For 'PUT', typically use an UPSERT on your backend
            await fetch(`${env.EXPO_PUBLIC_API_URL}/${op.table}/`, {
              method: "POST",
              headers,
              body: JSON.stringify(record),
            });
            break;
          case UpdateType.PATCH:
            await fetch(`${env.EXPO_PUBLIC_API_URL}/${op.table}/${op.id}/`, {
              method: "PATCH",
              headers,
              body: JSON.stringify(op.opData),
            });
            break;
          case UpdateType.DELETE:
            await fetch(`${env.EXPO_PUBLIC_API_URL}/${op.table}/${op.id}/`, {
              method: "DELETE",
              headers,
            });
            break;
        }
      }

      // Mark as complete so it's removed from the local queue
      await transaction.complete();
    } catch (error) {
      console.error("Upload failed, will retry automatically:", error);
      // Do NOT call transaction.complete() here;
      // PowerSync will retry this transaction later.
      throw error;
    }
  }
}
