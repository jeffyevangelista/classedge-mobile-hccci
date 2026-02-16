import { getPowerSyncToken } from "@/features/auth/auth.apis";
import { API_URL, POWERSYNC_ENDPOINT } from "@/utils/env";
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
    const res = await getPowerSyncToken();

    return {
      endpoint: POWERSYNC_ENDPOINT,
      token: res.token,
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

    const { accessToken } = useStore.getState();
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
            await fetch(`${API_URL}/${op.table}`, {
              method: "POST",
              headers,
              body: JSON.stringify(record),
            });
            break;
          case UpdateType.PATCH:
            await fetch(`${API_URL}/${op.table}/${op.id}/`, {
              method: "PATCH",
              headers,
              body: JSON.stringify(op.opData),
            });
            break;
          case UpdateType.DELETE:
            await fetch(`${API_URL}/${op.table}/${op.id}/`, {
              method: "DELETE",
              headers,
            });
            break;
        }
      }

      // 2. Mark as complete so it's removed from the local queue
      await transaction.complete();
    } catch (error) {
      console.error("Upload failed, will retry automatically:", error);
      // Do NOT call transaction.complete() here;
      // PowerSync will retry this transaction later.
      throw error;
    }
    // Completes the transaction and moves onto the next one
    await transaction.complete();
  }
}
