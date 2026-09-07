/** Default states seeded on project create (mirrors Django defaults + docs/03 §3.2). */
export const DEFAULT_STATES = [
  { name: "Backlog", group: "backlog", color: "#808080", isDefault: true, isTriage: false, sequence: 1000 },
  { name: "Todo", group: "unstarted", color: "#3b82f6", isDefault: false, isTriage: false, sequence: 2000 },
  { name: "In Progress", group: "started", color: "#f59e0b", isDefault: false, isTriage: false, sequence: 3000 },
  { name: "Done", group: "completed", color: "#22c55e", isDefault: false, isTriage: false, sequence: 4000 },
  { name: "Cancelled", group: "cancelled", color: "#ef4444", isDefault: false, isTriage: false, sequence: 5000 },
  { name: "Triage", group: "triage", color: "#a855f7", isDefault: false, isTriage: true, sequence: 6000 },
] as const;
