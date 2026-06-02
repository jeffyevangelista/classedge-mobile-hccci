import * as FileSystem from "expo-file-system/legacy";
import { env } from "@/utils/env";

export type FetchedAttachment = {
  localUri: string;
  sizeBytes: number;
};

export class AttachmentFetchError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly retriable: boolean,
  ) {
    super(message);
  }
}

const ATTACHMENTS_DIR = `${FileSystem.documentDirectory}attachments/`;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(ATTACHMENTS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(ATTACHMENTS_DIR, {
      intermediates: true,
    });
  }
}

function inferExt(url: string): string {
  const m = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return m ? m[1].toLowerCase() : "bin";
}

export type AttachmentProgressCallback = (
  downloaded: number,
  /** -1 if Content-Length is missing (chunked encoding). */
  total: number,
) => void;

export async function fetchAttachment(
  _resource: string,
  id: string,
  accessToken: string,
  onProgress?: AttachmentProgressCallback,
): Promise<FetchedAttachment> {
  await ensureDir();

  const metaUrl = `${env.EXPO_PUBLIC_API_URL}/mobile_attachment/${id}/`;
  console.log("metaUrl", metaUrl);
  const metaRes = await fetch(metaUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!metaRes.ok) {
    if (metaRes.status === 404) {
      throw new AttachmentFetchError("Not found", 404, false);
    }
    const retriable = metaRes.status >= 500 || metaRes.status === 401;
    throw new AttachmentFetchError(
      `Metadata fetch failed: ${metaRes.status}`,
      metaRes.status,
      retriable,
    );
  }

  const meta: { file?: string; binaryFile?: string } = await metaRes.json();

  if (!meta.file && !meta.binaryFile) {
    throw new AttachmentFetchError(
      "Response has neither file URL nor binaryFile",
      null,
      false,
    );
  }

  const ext = meta.file ? inferExt(meta.file) : "bin";
  const localUri = `${ATTACHMENTS_DIR}${id}.${ext}`;

  if (meta.file) {
    try {
      // Resumable download exposes per-chunk progress via the callback.
      // We're not actually pausing/resuming, just using it as the only
      // downloadAsync variant that streams progress events.
      const downloader = FileSystem.createDownloadResumable(
        meta.file,
        localUri,
        {},
        onProgress
          ? (data) => {
              const total = data.totalBytesExpectedToWrite;
              onProgress(
                data.totalBytesWritten,
                total > 0 ? total : -1,
              );
            }
          : undefined,
      );
      const result = await downloader.downloadAsync();
      if (!result) {
        throw new AttachmentFetchError(
          "Download returned no result",
          null,
          true,
        );
      }
      if (result.status >= 400) {
        await FileSystem.deleteAsync(localUri, { idempotent: true });
        if (!meta.binaryFile) {
          throw new AttachmentFetchError(
            `File URL returned ${result.status}`,
            result.status,
            result.status >= 500,
          );
        }
      } else {
        const info = await FileSystem.getInfoAsync(localUri);
        if (info.exists) {
          return {
            localUri,
            sizeBytes: (info as { size?: number }).size ?? 0,
          };
        }
      }
    } catch (e) {
      await FileSystem.deleteAsync(localUri, { idempotent: true });
      const msg = e instanceof Error ? e.message.toLowerCase() : "";
      if (msg.includes("enospc") || msg.includes("no space")) {
        throw new AttachmentFetchError("Out of disk space", null, false);
      }
      if (e instanceof AttachmentFetchError) throw e;
      throw new AttachmentFetchError(
        e instanceof Error ? e.message : String(e),
        null,
        true,
      );
    }
  }

  // binaryFile fallback (base64).
  try {
    await FileSystem.writeAsStringAsync(localUri, meta.binaryFile!, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const info = await FileSystem.getInfoAsync(localUri);
    return {
      localUri,
      sizeBytes: info.exists ? ((info as { size?: number }).size ?? 0) : 0,
    };
  } catch (e) {
    await FileSystem.deleteAsync(localUri, { idempotent: true });
    const msg = e instanceof Error ? e.message.toLowerCase() : "";
    if (msg.includes("enospc") || msg.includes("no space")) {
      throw new AttachmentFetchError("Out of disk space", null, false);
    }
    throw new AttachmentFetchError(
      e instanceof Error ? e.message : String(e),
      null,
      true,
    );
  }
}
