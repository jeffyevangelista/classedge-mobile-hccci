export type AttachmentColumnConfig = {
  table: string;
  column: string;
  resource: string;
  priority: number;
};

export const ATTACHMENT_COLUMNS: AttachmentColumnConfig[] = [
  {
    table: "accounts_profile",
    column: "student_photo",
    resource: "profile",
    priority: 1,
  },
  {
    table: "subject_subject",
    column: "subject_photo",
    resource: "subjectPhoto",
    priority: 1,
  },
  {
    table: "activity_studentactivity",
    column: "file",
    resource: "student_activity_files",
    priority: 1,
  },
  {
    table: "activity_retakerecorddetail",
    column: "uploaded_file",
    resource: "uploadDocuments",
    priority: 1,
  },
  {
    table: "module_module",
    column: "file",
    resource: "module",
    priority: 2,
  },
  {
    table: "activity_activity",
    column: "activity_file_instruction",
    resource: "activity_instructions",
    priority: 2,
  },
  {
    table: "activity_questionchoice",
    column: "choice_image",
    resource: "choice_images",
    priority: 2,
  },
];

export const TRACKED_TABLES = Array.from(
  new Set(ATTACHMENT_COLUMNS.map((c) => c.table)),
);

export const MAX_CONCURRENT_DOWNLOADS = 3;
export const LOW_STORAGE_THRESHOLD_BYTES = 100 * 1024 * 1024; // 100 MB

/**
 * Maximum number of times the watcher will auto-requeue a FAILED attachment.
 * Once retry_count >= this cap, the row stays FAILED until the user manually
 * retries (which resets the count).
 */
export const AUTO_RETRY_CAP = 3;

/**
 * Extracts the attachment id from a column value.
 * Returns null if the value is empty, a local file URI (pending upload), or unparseable.
 * The trailing file extension (after the last dot) is stripped, since the API
 * endpoint expects the bare id without an extension.
 *
 * Examples:
 *   "/media/abc/"        -> "abc"
 *   "/media/123.pdf"     -> "123"
 *   "/media/abc.jpg"     -> "abc"
 *   "abc"                -> "abc"
 *   "file:///tmp/x.jpg"  -> null  (pending upload)
 *   ""                   -> null
 *   null                 -> null
 */
export function extractAttachmentId(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("file://")) return null;
  const segments = value.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  if (!last) return null;
  const dot = last.lastIndexOf(".");
  const stripped = dot > 0 ? last.slice(0, dot) : last;
  return stripped.length > 0 ? stripped : null;
}
