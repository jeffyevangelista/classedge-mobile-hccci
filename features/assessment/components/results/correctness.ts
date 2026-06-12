import type { Choice, Question } from "../questions/types";

/**
 * Whether a question type is auto-gradable. Essay and image-upload types
 * require manual teacher review; everything else can be judged purely
 * from the student's answer vs the stored correct answer.
 */
export const isAutoGraded = (typeKey: string | null): boolean => {
  switch (typeKey) {
    case "multiple_choice":
    case "true_false":
    case "fill_in_the_blank":
    case "calculated_numeric":
    case "matching_type":
      return true;
    default:
      return false;
  }
};

// Student answers store matching pairings as `<leftChoiceId>-><rightChoiceId>`
// — numeric IDs of activity_questionchoice rows.
const parseIdPairings = (raw: string): Record<number, number> => {
  if (!raw || raw.trim().length === 0) return {};
  const result: Record<number, number> = {};
  for (const part of raw.split(",")) {
    const [l, r] = part.split("->").map((s) => s.trim());
    const lid = Number(l);
    const rid = Number(r);
    if (Number.isFinite(lid) && Number.isFinite(rid)) {
      result[lid] = rid;
    }
  }
  return result;
};

/**
 * Resolve a matching question's correct answer to `{leftId: rightId}`
 * id pairs.
 *
 * Format support:
 *   - New (post-server-migration):   `"59->60,61->62"` — already ids.
 *   - Legacy (pre-server-migration): `"left text -> right text, ..."`
 *     — resolve each side against the question's choices by text.
 *
 * We try the id path first because it's the steady-state format after
 * migration; the text path is a fallback during the transition.
 */
export const resolveMatchingCorrectPairings = (
  question: Question,
  choices: Choice[],
): Record<number, number> => {
  const raw = (question.correctAnswer ?? "").trim();
  if (!raw) return {};

  // Split tolerantly — whitespace around either separator is fine, so
  // both `"a -> b, c -> d"` and `"1->2,3->4"` parse the same way.
  const segments: Array<{ left: string; right: string }> = [];
  for (const part of raw.split(",")) {
    const arrow = part.indexOf("->");
    if (arrow < 0) continue;
    const left = part.slice(0, arrow).trim();
    const right = part.slice(arrow + 2).trim();
    if (left && right) segments.push({ left, right });
  }
  if (segments.length === 0) return {};

  const allNumeric = segments.every(
    (s) => /^\d+$/.test(s.left) && /^\d+$/.test(s.right),
  );

  if (allNumeric) {
    // Fast path: the new id-based format. No choice lookup needed.
    const result: Record<number, number> = {};
    for (const s of segments) {
      result[Number(s.left)] = Number(s.right);
    }
    return result;
  }

  // Legacy text path: build text → id maps from this question's choices
  // and resolve each pair. Empty/unknown halves are dropped silently.
  const questionChoices = choices.filter(
    (c) => Number(c.questionId) === Number(question.id),
  );
  const leftByText = new Map<string, number>();
  const rightByText = new Map<string, number>();
  for (const c of questionChoices) {
    const text = (c.choiceText ?? "").trim();
    if (!text) continue;
    if (c.isLeftSide) leftByText.set(text, Number(c.id));
    else rightByText.set(text, Number(c.id));
  }
  const result: Record<number, number> = {};
  for (const s of segments) {
    const lid = leftByText.get(s.left);
    const rid = rightByText.get(s.right);
    if (lid != null && rid != null) {
      result[lid] = rid;
    }
  }
  return result;
};

/**
 * Resolve the correct choice ID for an MC question. The backend stores
 * `question.correctAnswer` as a numeric index into the question's choices
 * sorted by `id` ascending — NOT the choice id itself. Returns null when
 * the index is missing, out of range, or no choices are available.
 */
export const resolveMcCorrectChoiceId = (
  question: Question,
  choices: Choice[],
): string | null => {
  const sorted = choices
    .filter((c) => Number(c.questionId) === Number(question.id))
    .sort((a, b) => Number(a.id) - Number(b.id));
  if (sorted.length === 0) return null;
  const idx = Number((question.correctAnswer ?? "").trim());
  if (!Number.isFinite(idx) || idx < 0 || idx >= sorted.length) return null;
  return String(sorted[idx].id);
};

/**
 * Per-type correctness check. Returns null for types we don't auto-grade
 * so the caller can render a "manually graded" affordance instead of a
 * red/green verdict.
 */
export const isAnswerCorrect = (
  typeKey: string | null,
  question: Question,
  studentAnswer: string,
  choices?: Choice[],
): boolean | null => {
  if (!isAutoGraded(typeKey)) return null;
  const a = (studentAnswer ?? "").trim();
  const c = (question.correctAnswer ?? "").trim();
  if (a.length === 0) return false;
  switch (typeKey) {
    case "multiple_choice": {
      const correctId = choices
        ? resolveMcCorrectChoiceId(question, choices)
        : null;
      return correctId != null && a === correctId;
    }
    case "true_false":
      return a === c;
    case "fill_in_the_blank":
      return a.toLowerCase() === c.toLowerCase();
    case "calculated_numeric": {
      const na = Number(a);
      const nc = Number(c);
      if (!Number.isFinite(na) || !Number.isFinite(nc)) return false;
      return na === nc;
    }
    case "matching_type": {
      if (!choices || choices.length === 0) return false;
      const correctIdPairings = resolveMatchingCorrectPairings(
        question,
        choices,
      );
      const studentIdPairings = parseIdPairings(a);
      const studentEntries = Object.entries(studentIdPairings);
      if (studentEntries.length === 0) return false;
      // Single-pair rule: the student answer is at most one pair. They
      // count as correct when their pair matches one of the teacher's
      // resolved correct pairs.
      return studentEntries.every(
        ([leftId, rightId]) =>
          correctIdPairings[Number(leftId)] === Number(rightId),
      );
    }
    default:
      return false;
  }
};
