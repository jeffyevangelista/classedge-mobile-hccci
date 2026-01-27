import { getPowerSyncToken } from "@/features/auth/auth.apis";
import { API_URL, POWERSYNC_ENDPOINT } from "@/utils/env";
import {
  type AbstractPowerSyncDatabase,
  type PowerSyncBackendConnector,
  UpdateType,
} from "@powersync/react-native";

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

    try {
      for (const op of transaction.crud) {
        // op.opData contains the columns (name, etc.)
        // op.id is the automatically managed 'id' column
        const record = { ...op.opData, id: op.id };

        switch (op.op) {
          case UpdateType.PUT:
            // For 'PUT', typically use an UPSERT on your backend
            await fetch(`${API_URL}/${op.table}`, {
              method: "POST",
              headers: {
                // DO NOT omit this. Without it, Express won't trigger the JSON parser.
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify(record),
            });
            break;
          case UpdateType.PATCH:
            await fetch(`${API_URL}/${op.table}/${op.id}`, {
              method: "PATCH",
              headers: {
                // DO NOT omit this. Without it, Express won't trigger the JSON parser.
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify(op.opData),
            });
            break;
          case UpdateType.DELETE:
            await fetch(`${API_URL}/${op.table}/${op.id}`, {
              method: "DELETE",
              headers: {
                // DO NOT omit this. Without it, Express won't trigger the JSON parser.
                "Content-Type": "application/json",
                Accept: "application/json",
              },
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
