import {
  type AbstractPowerSyncDatabase,
  createBaseLogger,
  LogLevel,
  type PowerSyncBackendConnector,
  UpdateType,
} from "@powersync/react-native";
import * as FileSystem from "expo-file-system/legacy";
import { silentRefresh } from "@/features/auth/useTokenRefresh";
import { appendSyncEvent } from "@/features/sync/syncEvents";
import {
  STUCK_ATTEMPT_CAP,
  clearCrudMeta,
  markCrudOpDropped,
  readCrudMeta,
  recordCrudAttempt,
} from "@/features/sync/crudMeta";
import { isPermanentStatus } from "@/features/sync/permanentStatuses";
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

export class UploadOpError extends Error {
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

/**
 * Wraps a single CRUD op fetch with a 401-recovery retry. On a 401 from the
 * server, forces a token rotation via silentRefresh and retries the same op
 * once with the rotated token. Any other error — including a second 401 after
 * refresh — re-throws so PowerSync re-queues the transaction normally.
 *
 * Each call site passes `rebuildAuthHeader(token)` because JSON and multipart
 * op shapes use different header sets, and the retry must preserve the right
 * shape (multipart omits `Content-Type` so the runtime can set the boundary).
 */
async function fetchOpWithAuthRetry(
  label: string,
  url: string,
  init: RequestInit,
  rebuildAuthHeader: (token: string) => Record<string, string>,
): Promise<Response> {
  try {
    return await fetchAndLog(label, url, init);
  } catch (err) {
    if (!(err instanceof UploadOpError) || err.status !== 401) throw err;

    const refreshed = await silentRefresh({ force: true });
    if (!refreshed) throw err;

    const refreshedToken = useStore.getState().accessToken;
    if (!refreshedToken) throw err;

    return await fetchAndLog(`${label} (retry-after-refresh)`, url, {
      ...init,
      headers: rebuildAuthHeader(refreshedToken),
    });
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

    const opIds: string[] = [];
    const droppedIds: string[] = [];
    try {
      for (const op of transaction.crud) {
        opIds.push(op.id);
        const started = Date.now();
        const target = `${op.table}/${op.id}`;
        try {
          // op.id is the PowerSync row id (the client cuid). The server uses
          // it as the local_id PK. Carry it in the URL, NOT the body — that's
          // what makes PUT replays idempotent.
          const record = { ...op.opData };
          const instanceUrl = `${env.EXPO_PUBLIC_API_URL}/${op.table}/${op.id}/`;
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
            url: instanceUrl,
          });

          switch (op.op) {
            case UpdateType.PUT:
              if (hasFile) {
                const multipartHeaders: Record<string, string> = {
                  Accept: "application/json",
                  "X-Platform": "mobile",
                };
                if (accessToken)
                  multipartHeaders.Authorization = `Bearer ${accessToken}`;

                await fetchOpWithAuthRetry(
                  `PUT-multipart ${op.table} ${op.id}`,
                  instanceUrl,
                  {
                    method: "PUT",
                    headers: multipartHeaders,
                    body: buildMultipartBody(record),
                  },
                  (token) => ({
                    Accept: "application/json",
                    "X-Platform": "mobile",
                    Authorization: `Bearer ${token}`,
                  }),
                );
              } else {
                await fetchOpWithAuthRetry(
                  `PUT-json ${op.table} ${op.id}`,
                  instanceUrl,
                  {
                    method: "PUT",
                    headers,
                    body: JSON.stringify(record),
                  },
                  (token) => ({ ...headers, Authorization: `Bearer ${token}` }),
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
                await fetchOpWithAuthRetry(
                  `PATCH-multipart ${op.table} ${op.id}`,
                  `${env.EXPO_PUBLIC_API_URL}/${op.table}/${op.id}/`,
                  {
                    method: "PATCH",
                    headers: authHeaders,
                    body: buildMultipartBody({ ...op.opData }),
                  },
                  (token) => ({
                    Accept: "application/json",
                    "X-Platform": "mobile",
                    Authorization: `Bearer ${token}`,
                  }),
                );
              } else {
                await fetchOpWithAuthRetry(
                  `PATCH-json ${op.table} ${op.id}`,
                  `${env.EXPO_PUBLIC_API_URL}/${op.table}/${op.id}/`,
                  {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify(op.opData),
                  },
                  (token) => ({ ...headers, Authorization: `Bearer ${token}` }),
                );
              }
              break;
            case UpdateType.DELETE:
              await fetchOpWithAuthRetry(
                `DELETE ${op.table} ${op.id}`,
                `${env.EXPO_PUBLIC_API_URL}/${op.table}/${op.id}/`,
                { method: "DELETE", headers },
                (token) => ({ ...headers, Authorization: `Bearer ${token}` }),
              );
              break;
          }
          await appendSyncEvent({
            kind: "upload",
            target,
            status: "ok",
            durationMs: Date.now() - started,
          });
        } catch (opErr) {
          const httpStatus =
            opErr instanceof UploadOpError ? opErr.status : null;
          const message =
            opErr instanceof Error ? opErr.message : String(opErr);

          // Record the attempt first so `readCrudMeta` below sees the just-incremented
          // count. Required for the stuck-cap classification path.
          await recordCrudAttempt(op.id, { error: message, httpStatus });

          const meta = await readCrudMeta(op.id);
          const attemptCount = meta?.attempt_count ?? 1;
          const shouldDrop =
            isPermanentStatus(httpStatus) || attemptCount >= STUCK_ATTEMPT_CAP;

          if (shouldDrop) {
            await markCrudOpDropped(op.id, {
              target,
              error: message,
              httpStatus,
            });
            await appendSyncEvent({
              kind: "upload",
              target,
              status: "dropped",
              httpStatus,
              message,
              durationMs: Date.now() - started,
            });
            droppedIds.push(op.id);
            continue;
          }

          await appendSyncEvent({
            kind: "upload",
            target,
            status: "fail",
            httpStatus,
            message,
            durationMs: Date.now() - started,
          });
          throw opErr;
        }
      }

      // Mark as complete so the processed ops (succeeded or dropped) are
      // removed from the local queue. Dropped meta rows survive because we
      // filter them out of the clearCrudMeta call below — the Sync Center
      // "Failed" section reads them via useFailedCrudOps.
      await transaction.complete();
      const succeededIds = opIds.filter((id) => !droppedIds.includes(id));
      await clearCrudMeta(succeededIds);
    } catch (error) {
      console.error("Upload failed, will retry automatically:", error);
      // Do NOT call transaction.complete() here;
      // PowerSync will retry this transaction later.
      throw error;
    }
  }
}
