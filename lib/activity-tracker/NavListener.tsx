import { useEffect, useRef } from "react";
import { usePathname } from "expo-router";
import { track } from "./index";
import { matchPath } from "./registry";

/**
 * Mount-and-forget component. Watches the current expo-router pathname and
 * emits an `open_*` audit event when the user navigates onto a screen that
 * the registry maps. No-op for unmapped screens.
 *
 * Params come from parsing the pathname against the registry template — NOT
 * from `useLocalSearchParams`, which only works when called from inside the
 * route component itself.
 */
export function NavListener(): null {
  const pathname = usePathname();
  const lastEmittedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    const matched = matchPath(pathname);
    if (!matched) return;

    const ids = matched.entry.extract(matched.params);
    const key = `${matched.templatedPath}::${JSON.stringify(ids)}`;
    if (lastEmittedRef.current === key) return;
    lastEmittedRef.current = key;

    track(matched.entry.action, ids);
  }, [pathname]);

  return null;
}
