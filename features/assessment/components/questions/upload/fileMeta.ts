import * as FileSystem from "expo-file-system/legacy";

export type FileMetaType = "image" | "pdf" | "doc" | "other";

export interface FileMeta {
  filename: string;
  type: FileMetaType;
  size?: number;
}

const IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "heic"];
const DOC_EXTS = ["doc", "docx", "rtf", "txt", "odt"];

export const getExt = (uri: string): string => {
  const cleaned = uri.split("?")[0].split("#")[0];
  const base = cleaned.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
};

export const getFileType = (uri: string): FileMetaType => {
  const ext = getExt(uri);
  if (IMAGE_EXTS.includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (DOC_EXTS.includes(ext)) return "doc";
  return "other";
};

export const getFilename = (uri: string): string => {
  const cleaned = uri.split("?")[0].split("#")[0];
  const last = cleaned.split("/").pop() ?? "attachment";
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
};

export const formatSize = (bytes?: number): string | null => {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const typeLabel = (type: FileMetaType): string => {
  switch (type) {
    case "image":
      return "Image";
    case "pdf":
      return "PDF";
    case "doc":
      return "Document";
    default:
      return "File";
  }
};

export const getFileMeta = async (uri: string): Promise<FileMeta> => {
  const filename = getFilename(uri);
  const type = getFileType(uri);
  let size: number | undefined;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists && "size" in info && typeof info.size === "number") {
      size = info.size;
    }
  } catch {
    // Best-effort; size stays undefined.
  }
  return { filename, type, size };
};
