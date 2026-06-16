/**
 * Map a Connector `target` string ("${table}/${id}") to a human-readable
 * feature label. Used by the dropped-op toast and the Failed section in
 * Sync Center. Unknown tables fall back to the raw table name rather than
 * crashing or showing `undefined` — visible enough that the gap is obvious
 * and we add an entry, but never a hard error.
 */

const TABLE_LABELS: Record<string, string> = {
  accounts_profile: "Profile photo",
  activity_studentactivity: "Activity submission",
  subject_subject: "Subject photo",
  module_module: "Module file",
  activity_activity: "Activity",
  activity_questionchoice: "Question choice image",
  activity_activityquestion: "Question instruction",
  activity_retakerecorddetail: "Retake upload",
};

export function featureLabelFromTarget(target: string | null | undefined): string {
  if (!target) return "Sync";
  const table = target.split("/")[0];
  return TABLE_LABELS[table] ?? table;
}
