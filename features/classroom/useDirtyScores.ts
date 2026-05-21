import { useMemo } from "react";
import type { RowImage } from "./components/StudentScoreItem";

type StudentLike = { studentId: number };

type Args<T extends StudentLike> = {
  students: T[];
  localScores: Record<number, string>;
  imagesByStudent: Record<number, RowImage>;
  scoresMap: Record<number, number>;
  maxScore: number;
};

/**
 * Derives which students have unsaved changes. A row is dirty when:
 *   1. The image was edited and an existing row is available to UPDATE
 *      (image-only path; we never insert a fresh row with no score).
 *   2. The score field contains a valid value that differs from the saved
 *      value, OR the image was edited alongside it.
 * Invalid scores block their own row, even if the image is dirty.
 */
export function useDirtyScores<T extends StudentLike>({
  students,
  localScores,
  imagesByStudent,
  scoresMap,
  maxScore,
}: Args<T>) {
  const dirtyStudentIds = useMemo(() => {
    if (!students.length) return new Set<number>();
    const dirty = new Set<number>();
    for (const s of students) {
      const local = localScores[s.studentId];
      const imageDirty = imagesByStudent[s.studentId]?.dirty === true;
      const hasExistingRow = scoresMap[s.studentId] !== undefined;

      if (local === undefined || local === "") {
        if (imageDirty && hasExistingRow) dirty.add(s.studentId);
        continue;
      }

      const numericScore = parseInt(local, 10);
      if (isNaN(numericScore) || numericScore < 0 || numericScore > maxScore) {
        continue;
      }

      const saved = scoresMap[s.studentId];
      const scoreChanged = saved === undefined || saved !== numericScore;
      if (scoreChanged || imageDirty) dirty.add(s.studentId);
    }
    return dirty;
  }, [students, localScores, imagesByStudent, scoresMap, maxScore]);

  return {
    dirtyStudentIds,
    hasUnsavedChanges: dirtyStudentIds.size > 0,
  };
}
