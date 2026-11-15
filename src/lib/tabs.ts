export type DashboardTab =
  | "today"
  | "medications"
  | "appointments"
  | "members"
  | "adherence"
  | "settings";

export const VALID_TABS: readonly DashboardTab[] = [
  "today",
  "medications",
  "appointments",
  "members",
  "adherence",
  "settings",
] as const;

export function isValidTab(tab: unknown): tab is DashboardTab {
  return (
    typeof tab === "string" &&
    (VALID_TABS as readonly string[]).includes(tab as DashboardTab)
  );
}
