import type { IconName } from "@/components/Icon";

export type ArchiveCapableRole =
  | "Student" | "Teacher" | "Program Head" | "Academic Director";

export type ViewKey = "current" | "archived" | "coil" | "hali" | "cte";

export const getRoleTabPath = (role: string | undefined): string | null => {
  if (role === "Student") return "/(main)/(drawer)/(tabs)/courses";
  if (role === "Teacher") return "/(main)/(drawer)/(tabs)/teaching";
  if (role === "Program Head" || role === "Academic Director")
    return "/(main)/(drawer)/(tabs)/oversight";
  return null;
};

type DrawerItem = {
  label: string;
  view: ViewKey;
  section?: string;
  icon: IconName;
};

export const getDrawerItems = (role: string | undefined): DrawerItem[] => {
  if (role === "Student")
    return [
      { label: "My Courses", view: "current", icon: "BookOpenIcon" },
      ...(__DEV__
        ? [{ label: "Archived Courses", view: "archived", icon: "ArchiveIcon" } as DrawerItem]
        : []),
      { label: "COIL", view: "coil", section: "Orbit Program", icon: "GlobeIcon" },
      { label: "HALI", view: "hali", section: "Orbit Program", icon: "HandshakeIcon" },
      { label: "CTE", view: "cte", section: "Orbit Program", icon: "WrenchIcon" },
    ];
  if (role === "Teacher")
    return [
      { label: "Teaching", view: "current", icon: "BookOpenIcon" },
      ...(__DEV__
        ? [{ label: "Archived Courses", view: "archived", icon: "ArchiveIcon" } as DrawerItem]
        : []),
      { label: "COIL", view: "coil", section: "Orbit Program", icon: "GlobeIcon" },
      { label: "HALI", view: "hali", section: "Orbit Program", icon: "HandshakeIcon" },
      { label: "CTE", view: "cte", section: "Orbit Program", icon: "WrenchIcon" },
    ];
  if (role === "Program Head" || role === "Academic Director")
    return [
      { label: "Courses", view: "current", icon: "BookOpenIcon" },
      ...(__DEV__
        ? [{ label: "Archived Courses", view: "archived", icon: "ArchiveIcon" } as DrawerItem]
        : []),
    ];
  return [];
};
