/** HTML-safe escaping for dynamic content. */
export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type ProjectStatus =
  | "INITIAL_REQUEST"
  | "PROJECT_DATA_SUPPLIED_NOT_YET_PROCESSED"
  | "PROJECT_UNDERWAY"
  | "PROJECT_NEAR_FINAL"
  | "PROJECT_FINISHED";

export function statusLabel(status: ProjectStatus | string): string {
  switch (status) {
    case "INITIAL_REQUEST":
      return "Project gestart";
    case "PROJECT_DATA_SUPPLIED_NOT_YET_PROCESSED":
      return "Gegevens aangeleverd — nog niet verwerkt";
    case "PROJECT_UNDERWAY":
      return "Project in uitvoering";
    case "PROJECT_NEAR_FINAL":
      return "Project bijna afgerond";
    case "PROJECT_FINISHED":
      return "Project afgerond";
    default:
      return status;
  }
}
