import { useMemo } from "react";
import useStore from "@/lib/store";
import { useQuery } from "@powersync/react-native";
import { toCompilableQuery } from "@powersync/drizzle-driver";
import { getTeachingCourses } from "./teaching.services";

type OrbitFlag = "coil" | "hali" | "cte";

// Raw fetch — every teaching course, no orbit filter. Private to this file;
// the two public hooks below each apply their own predicate.
const useTeachingCoursesRaw = () => {
  const { authUser } = useStore.getState();

  const { data, isLoading, isFetching, error, refresh } = useQuery(
    toCompilableQuery(getTeachingCourses(authUser?.id!)),
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

// Default Teaching view — excludes any course flagged as COIL / HALI / CTE
// so orbit courses appear only under their dedicated drawer entries.
export const useTeachingCourses = () => {
  const base = useTeachingCoursesRaw();

  const data = useMemo(
    () => (base.data ?? []).filter((c) => !c.isCoil && !c.isHali && !c.isCte),
    [base.data],
  );

  return { ...base, data };
};

// Orbit views — same raw fetch, filtered to rows where the matching flag
// is set. Mirrors the student-side useOrbitCourses pattern.
export const useTeachingOrbitCourses = (flag: OrbitFlag) => {
  const base = useTeachingCoursesRaw();

  const data = useMemo(
    () =>
      (base.data ?? []).filter((c) => {
        if (flag === "coil") return !!c.isCoil;
        if (flag === "hali") return !!c.isHali;
        return !!c.isCte;
      }),
    [base.data, flag],
  );

  return { ...base, data };
};
