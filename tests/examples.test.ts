/**
 * Every shipped example (except the deliberately broken one) must be
 * well-formed, lint-clean (no errors/warnings) and valid against the X3D 4.0 XSD.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { lintX3D } from "../src/validation/lint";
import { X3DSchemaValidator, X3D_SCHEMA_FILES } from "../src/validation/xsd";

const here = dirname(fileURLToPath(import.meta.url));
const exDir = join(here, "..", "public", "examples");
const schemaDir = join(here, "..", "public", "schema");
const files = readdirSync(exDir).filter((f) => f.endsWith(".x3d"));

let validator: X3DSchemaValidator;
beforeAll(() => {
  const sources: Record<string, string> = {};
  for (const file of Object.keys(X3D_SCHEMA_FILES)) sources[file] = readFileSync(join(schemaDir, file), "utf8");
  validator = X3DSchemaValidator.create(sources);
});
afterAll(() => validator?.dispose());

describe("example scenes", () => {
  it("are all listed in index.json", () => {
    const index = JSON.parse(readFileSync(join(exDir, "index.json"), "utf8")) as { file: string }[];
    expect(index.map((e) => e.file).sort()).toEqual(files.sort());
  });

  for (const f of files) {
    const xml = readFileSync(join(exDir, f), "utf8");
    if (f.startsWith("broken")) {
      it(`${f} is broken in the documented ways`, () => {
        const rules = lintX3D(xml).map((i) => i.rule);
        for (const r of ["root/profile", "field/unknown", "placement/no-such-field", "use/undefined", "value/bool", "interp/count-mismatch", "route/unknown-node", "route/type-mismatch", "value/arity"]) {
          expect(rules, r).toContain(r);
        }
      });
      continue;
    }
    it(`${f} passes lint without errors or warnings`, () => {
      const issues = lintX3D(xml).filter((i) => i.severity !== "info");
      expect(issues).toEqual([]);
    });
    it(`${f} validates against the X3D 4.0 XSD`, () => {
      const r = validator.validate(xml);
      expect(r.issues).toEqual([]);
    });
  }
});
