import { env } from "@/utils/env";
import useStore from "@/lib/store";
import {
  type AbstractPowerSyncDatabase,
  type PowerSyncBackendConnector,
  UpdateType,
} from "@powersync/react-native";
import { createBaseLogger, LogLevel } from "@powersync/react-native";
import * as FileSystem from "expo-file-system/legacy";

const MIME_MAP: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
};

function isLocalFileUri(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("file://");
}

function buildMultipartBody(record: Record<string, any>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(record)) {
    if (key === "file" && isLocalFileUri(value)) {
      const filename = value.split("/").pop() ?? "upload.jpg";
      const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
      formData.append("file", {
        uri: value,
        name: filename,
        type: MIME_MAP[ext] ?? "application/octet-stream",
      } as any);
    } else if (value != null) {
      formData.append(key, String(value));
    }
  }
  return formData;
}

async function hasLocalFile(record: Record<string, any>): Promise<boolean> {
  const uri = record.file;
  if (!isLocalFileUri(uri)) return false;
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists;
}

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
        const hasFile = await hasLocalFile(record);

        switch (op.op) {
          case UpdateType.PUT:
            if (hasFile) {
              const authHeaders: Record<string, string> = {};
              if (accessToken)
                authHeaders.Authorization = `Bearer ${accessToken}`;
              await fetch(`${env.EXPO_PUBLIC_API_URL}/${op.table}/`, {
                method: "POST",
                headers: authHeaders,
                body: buildMultipartBody(record),
              });
            } else {
              await fetch(`${env.EXPO_PUBLIC_API_URL}/${op.table}/`, {
                method: "POST",
                headers,
                body: JSON.stringify(record),
              });
            }
            break;
          case UpdateType.PATCH:
            if (hasFile) {
              const authHeaders: Record<string, string> = {};
              if (accessToken)
                authHeaders.Authorization = `Bearer ${accessToken}`;
              await fetch(`${env.EXPO_PUBLIC_API_URL}/${op.table}/${op.id}/`, {
                method: "PATCH",
                headers: authHeaders,
                body: buildMultipartBody({ ...op.opData }),
              });
            } else {
              await fetch(`${env.EXPO_PUBLIC_API_URL}/${op.table}/${op.id}/`, {
                method: "PATCH",
                headers,
                body: JSON.stringify(op.opData),
              });
            }
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
