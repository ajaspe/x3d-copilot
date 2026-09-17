export type Severity = "error" | "warning" | "info";

export type IssueSource = "xml" | "lint" | "schema" | "runtime";

export interface Issue {
  severity: Severity;
  message: string;
  /** 1-based line number in the source document, when known */
  line?: number;
  col?: number;
  source: IssueSource;
  /** stable rule identifier, e.g. "route/unknown-node" */
  rule?: string;
  /** optional machine-actionable hint (e.g. suggested replacement) */
  hint?: string;
}

export function countBySeverity(issues: Issue[]): Record<Severity, number> {
  const c: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const i of issues) c[i.severity]++;
  return c;
}

export function formatIssues(issues: Issue[], max = 40): string {
  if (issues.length === 0) return "No issues.";
  const lines = issues.slice(0, max).map((i) => {
    const where = i.line ? `L${i.line}${i.col ? `:${i.col}` : ""} ` : "";
    return `[${i.severity}] ${where}${i.message}${i.hint ? ` (hint: ${i.hint})` : ""}`;
  });
  if (issues.length > max) lines.push(`... and ${issues.length - max} more`);
  return lines.join("\n");
}
