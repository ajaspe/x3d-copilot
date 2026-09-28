/**
 * Validation pipeline: well-formedness + semantic lint (sync, always on) and
 * XSD validation against the official X3D 4.0 schema (loaded lazily).
 */
import { lintX3D } from "./lint";
import { X3DSchemaValidator, X3D_SCHEMA_FILES } from "./xsd";
import type { Issue } from "./issues";

export interface ValidationResult {
  issues: Issue[];
  schemaChecked: boolean;
}

export class Validator {
  private xsd: X3DSchemaValidator | null = null;
  private loading: Promise<void> | null = null;
  schemaError: string | null = null;

  constructor(private schemaBaseUrl: string) {}

  /** Kick off (once) fetching + compiling the X3D 4.0 XML Schema. */
  ensureSchema(): Promise<void> {
    if (!this.loading) {
      this.loading = (async () => {
        try {
          const sources: Record<string, string> = {};
          await Promise.all(
            Object.keys(X3D_SCHEMA_FILES).map(async (file) => {
              const res = await fetch(this.schemaBaseUrl + file);
              if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
              sources[file] = await res.text();
            }),
          );
          this.xsd = X3DSchemaValidator.create(sources);
        } catch (e) {
          this.schemaError = `Schema validation unavailable: ${(e as Error).message}`;
          console.warn(this.schemaError);
        }
      })();
    }
    return this.loading;
  }

  get schemaReady(): boolean {
    return this.xsd !== null;
  }

  validate(xml: string): ValidationResult {
    const issues = lintX3D(xml);
    const wellFormed = !issues.some((i) => i.source === "xml");
    let schemaChecked = false;
    if (wellFormed && this.xsd) {
      schemaChecked = true;
      const r = this.xsd.validate(xml);
      const lintLines = new Set(issues.filter((i) => i.severity === "error").map((i) => i.line));
      for (const s of r.issues) {
        // The linter already explains problems on these lines in friendlier terms;
        // keep the schema message but demote it to avoid double-counting errors.
        const dup = s.line !== undefined && lintLines.has(s.line);
        issues.push({
          severity: dup ? "info" : "error",
          message: s.message,
          line: s.line,
          col: s.col,
          source: "schema",
          rule: "xsd",
        });
      }
    }
    issues.sort((a, b) => (a.line ?? 0) - (b.line ?? 0) || sevRank(a) - sevRank(b));
    return { issues, schemaChecked };
  }
}

function sevRank(i: Issue): number {
  return i.severity === "error" ? 0 : i.severity === "warning" ? 1 : 2;
}
