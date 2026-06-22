import { toCompilableQuery } from "@powersync/drizzle-driver";
import { useQuery as usePowerSyncQuery } from "@powersync/react-native";
import { useMemo } from "react";
import useStore from "@/lib/store";
import { getStudentOrbitCourses } from "./courses.service";

type OrbitFlag = "coil" | "hali" | "cte";

export const useOrbitCourses = (flag: OrbitFlag) => {
  const authUser = useStore((s) => s.authUser);
  const studentId = authUser?.id ?? 0;

  const {
    data: rows,
    isLoading,
    isFetching,
    error,
    refresh,
  } = usePowerSyncQuery(toCompilableQuery(getStudentOrbitCourses(studentId)));

  const data = useMemo(
    () =>
      (rows ?? []).filter((e) => {
        if (e.subjectId == null) return false;
        if (flag === "coil") return !!e.subjectId.isCoil;
        if (flag === "hali") return !!e.subjectId.isHali;
        return !!e.subjectId.isCte;
      }),
    [rows, flag],
  );

  return {
    data,
    isLoading,
    isFetching,
    isError: !!error,
    error,
    refetch: refresh ?? (async () => {}),
    isRefetching: isFetching && !isLoading,
  };
};
