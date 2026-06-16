import { useEffect, useRef } from "react";
import { useLocalSearchParams, usePathname } from "expo-router";
import { track } from "./index";
import { matchPath } from "./registry";

/**
 * Mount-and-forget component. Watches the current expo-router pathname and
 * emits an `open_*` audit event when the user navigates onto a screen that
 * the registry maps. No-op for unmapped screens.
 */
export function NavListener(): null {
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const lastEmittedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;

    const paramRecord = params as Record<string, string | string[] | undefined>;
    const matched = matchPath(pathname, paramRecord);
    if (!matched) return;

    const ids = matched.entry.extract(paramRecord);
    const key = `${matched.templatedPath}::${JSON.stringify(ids)}`;
    if (lastEmittedRef.current === key) return;
    lastEmittedRef.current = key;

    track(matched.entry.action, ids);
  }, [pathname, params]);

  return null;
}
