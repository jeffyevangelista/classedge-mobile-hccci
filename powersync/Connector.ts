import {
  type AbstractPowerSyncDatabase,
  createBaseLogger,
  LogLevel,
  type PowerSyncBackendConnector,
  UpdateType,
} from "@powersync/react-native";
import * as FileSystem from "expo-file-system/legacy";
import { silentRefresh } from "@/features/auth/useTokenRefresh";
import useStore from "@/lib/store";
import { env } from "@/utils/env";

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
    if (isLocalFileUri(value)) {
      const filename = value.split("/").pop() ?? "upload.jpg";
      const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
      formData.append(key, {
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
  for (const value of Object.values(record)) {
    if (!isLocalFileUri(value)) continue;
    const info = await FileSystem.getInfoAsync(value);
    if (info.exists) return true;
  }
  return false;
}

class UploadOpError extends Error {
  status: number;
  body: string;
  constructor(label: string, status: number, body: string) {
    super(`[Connector] ${label} failed with HTTP ${status}. Body: ${body}`);
    this.name = "UploadOpError";
    this.status = status;
    this.body = body;
  }
}

async function fetchAndLog(
  label: string,
  url: string,
  init: RequestInit,
): Promise<Response> {
  const started = Date.now();
  try {
    const res = await fetch(url, init);
    let body = "";
    try {
      body = (await res.clone().text()).slice(0, 500);
    } catch {
      body = "<could not read body>";
    }
    console.log("[Connector] response:", {
      label,
      url,
      status: res.status,
      ok: res.ok,
      ms: Date.now() - started,
      body,
    });
    // Throw on any non-2xx so the outer transaction.complete() is skipped
    // and PowerSync keeps the op queued for retry. Previously the fetch
    // succeeded and the op was silently marked done even on 4xx/5xx,
    // which is how orphan rows landed in the local DB during the 403
    // multipart period.
    if (!res.ok) {
      throw new UploadOpError(label, res.status, body);
    }
    return res;
  } catch (err) {
    console.log("[Connector] fetch threw:", {
      label,
      url,
      ms: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
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

  // Called by the PowerSync SDK when it decides the current token is no
  // longer valid (server returned did_expire, or the token is <30s from
  // expiry). The SDK clears its cached creds, calls this hook, then
  // re-invokes fetchCredentials — so we force a refresh here regardless
  // of the usual 5-min buffer to make sure the next fetchCredentials
  // returns a rotated powersyncToken.
  //
  // Method is optional on the SDK interface (called via `?.()`), so the
  // SDK tolerates this being absent — we declare it without `override`.
  async invalidateCredentials(): Promise<void> {
    try {
      await silentRefresh({ force: true });
    } catch (err) {
      console.warn(
        "[Connector.invalidateCredentials] silentRefresh failed:",
        err,
      );
    }
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

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Platform": "mobile",
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
        const fileFields = Object.entries(record)
          .filter(([, v]) => isLocalFileUri(v))
          .map(([k, v]) => ({ field: k, uri: v }));
        console.log("[Connector] op:", {
          op: op.op,
          table: op.table,
          id: op.id,
          hasFile,
          fileFields,
          url:
            op.op === UpdateType.PUT
              ? `${env.EXPO_PUBLIC_API_URL}/${op.table}/`
              : `${env.EXPO_PUBLIC_API_URL}/${op.table}/${op.id}/`,
        });

        switch (op.op) {
          case UpdateType.PUT:
            if (hasFile) {
              // Accept: application/json forces DRF to render errors as JSON
              // instead of the browsable-API HTML page. Without it, a 403/400
              // on multipart comes back as an HTML body that's impossible to
              // act on. Content-Type is intentionally NOT set so fetch can
              // generate the multipart boundary itself.
              const multipartHeaders: Record<string, string> = {
                Accept: "application/json",
                "X-Platform": "mobile",
              };
              if (accessToken)
                multipartHeaders.Authorization = `Bearer ${accessToken}`;

              await fetchAndLog(
                `PUT-multipart ${op.table} ${op.id}`,
                `${env.EXPO_PUBLIC_API_URL}/${op.table}/`,
                {
                  method: "POST",
                  headers: multipartHeaders,
                  body: buildMultipartBody(record),
                },
              );
            } else {
              await fetchAndLog(
                `PUT-json ${op.table} ${op.id}`,
                `${env.EXPO_PUBLIC_API_URL}/${op.table}/`,
                {
                  method: "POST",
                  headers,
                  body: JSON.stringify(record),
                },
              );
            }
            break;
          case UpdateType.PATCH:
            if (hasFile) {
              const authHeaders: Record<string, string> = {
                Accept: "application/json",
                "X-Platform": "mobile",
              };
              if (accessToken)
                authHeaders.Authorization = `Bearer ${accessToken}`;
              await fetchAndLog(
                `PATCH-multipart ${op.table} ${op.id}`,
                `${env.EXPO_PUBLIC_API_URL}/${op.table}/${op.id}/`,
                {
                  method: "PATCH",
                  headers: authHeaders,
                  body: buildMultipartBody({ ...op.opData }),
                },
              );
            } else {
              await fetchAndLog(
                `PATCH-json ${op.table} ${op.id}`,
                `${env.EXPO_PUBLIC_API_URL}/${op.table}/${op.id}/`,
                {
                  method: "PATCH",
                  headers,
                  body: JSON.stringify(op.opData),
                },
              );
            }
            break;
          case UpdateType.DELETE:
            await fetchAndLog(
              `DELETE ${op.table} ${op.id}`,
              `${env.EXPO_PUBLIC_API_URL}/${op.table}/${op.id}/`,
              { method: "DELETE", headers },
            );
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
