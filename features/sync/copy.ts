/**
 * Single source of truth for every user-facing string in the Sync Center
 * route. Future i18n is a one-place swap.
 */
export const SYNC_COPY = {
  routeTitle: "Sync Center",
  lastSyncedNever: "Never synced",
  lastSyncedRelative: (relative: string) => `Last sync · ${relative}`,

  status: {
    syncing: "Sending your recent changes…",
    synced: "Your work is saved and synced to the cloud.",
    downloading: "Loading the latest data from your courses.",
    offline: "You're offline. We'll sync automatically when you reconnect.",
    offlineWithPending: (n: number) =>
      `You're offline. ${n} item${n === 1 ? "" : "s"} saved here will send when you're back online.`,
    lowStorage:
      "Your device is low on space. New downloads are paused until you free up storage.",
    connecting: "Reconnecting to the cloud…",
    reconnect: "Reconnect",
  },

  queue: {
    heading: "Queue",
    empty: "You're all caught up.",
    emptySubtitle: "Nothing is waiting to sync right now.",
    uploadRow: (table: string, op: string) => `↑ ${table} · ${op}`,
    downloadRow: (resource: string) => `↓ ${resource}`,
  },

  stuck: {
    heading: "Stuck",
    needsAttention: "needs attention",
    empty: "No problems to fix.",
    emptySubtitle: "If something gets stuck, you'll see it here.",
    showDetails: "Show details",
    hideDetails: "Hide details",
    retry: "Retry",
    attempts: (n: number) => `${n} attempt${n === 1 ? "" : "s"}`,
    firstFailed: (relative: string) => `First failed ${relative}`,
  },

  failed: {
    heading: "Failed",
    needsAttention: "won't retry",
    empty: "Nothing has been permanently dropped.",
    emptySubtitle: "If an upload can't recover, we'll list it here.",
    showDetails: "Show details",
    hideDetails: "Hide details",
    dismiss: "Dismiss",
    httpLabel: (status: number | null) => (status != null ? `HTTP ${status}` : "no response"),
    droppedAt: (relative: string) => `Dropped ${relative}`,
  },

  events: {
    heading: "Events",
    subheading: "Last 200 sync events",
    empty: "No recent sync activity.",
    loadOlder: "Load older",
    export: "Export log",
  },

  advanced: {
    heading: "Advanced",
    streamsHeading: "Sync streams",
    storageHeading: "Storage",
    storageRow: (usedMb: string, freeMb: string) =>
      `${usedMb} MB used by attachments · ${freeMb} MB free on device`,
    streamSyncedBadge: "synced",
    streamPendingBadge: "pending",
  },

  iconA11y: {
    base: "Sync center",
    failedBadge: (n: number) => `, ${n} download${n === 1 ? "" : "s"} failed`,
  },
} as const;
