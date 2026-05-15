// features/attachments/file-type.ts

export type FileTypeKind = "image" | "video" | "pdf" | "other";

export const IMAGE_EXTS = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "heic",
  "heif",
  "bmp",
  "tiff",
  "tif",
  "avif",
  "jfif",
  "svg",
];

export const VIDEO_EXTS = [
  "mp4",
  "mov",
  "avi",
  "mkv",
  "webm",
  "m4v",
  "3gp",
  "3g2",
  "wmv",
  "flv",
  "f4v",
  "ts",
  "mts",
  "m2ts",
  "mpg",
  "mpeg",
  "mp2",
  "mpe",
  "ogv",
  "ogg",
  "rm",
  "rmvb",
  "asf",
  "divx",
  "vob",
  "dv",
  "mxf",
];

export const getFileType = (path: string): FileTypeKind => {
  const cleaned = path.split("?")[0].split("#")[0];
  const base = cleaned.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
  if (IMAGE_EXTS.includes(ext)) return "image";
  if (VIDEO_EXTS.includes(ext)) return "video";
  if (ext === "pdf") return "pdf";
  return "other";
};
