import { useCallback } from "react";
import { powersync } from "@/powersync/system";

/**
 * Writes a new value to accounts_profile.student_photo for the given profile
 * id (= Profile.pk, the integer PK of the synced row). The Connector picks
 * up the resulting PATCH op from the PowerSync CRUD queue — if the value is
 * a file:// URI, it sends multipart; if it's an empty string, it sends JSON
 * `{"student_photo": ""}`. The server-side ProfileWriteSerializer treats
 * empty as "clear the field".
 */
export function useUpdateStudentPhoto() {
  return useCallback(async (profileId: number, value: string) => {
    await powersync.execute(
      "UPDATE accounts_profile SET student_photo = ? WHERE id = ?",
      [value, profileId],
    );
  }, []);
}
