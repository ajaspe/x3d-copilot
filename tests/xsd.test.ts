import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { X3DSchemaValidator, X3D_SCHEMA_FILES } from "../src/validation/xsd";

const here = dirname(fileURLToPath(import.meta.url));
const schemaDir = join(here, "..", "public", "schema");
const fixture = (name: string) => readFileSync(join(here, "fixtures", name), "utf8");

let validator: X3DSchemaValidator;

beforeAll(() => {
  const sources: Record<string, string> = {};
  for (const file of Object.keys(X3D_SCHEMA_FILES)) {
    sources[file] = readFileSync(join(schemaDir, file), "utf8");
  }
  validator = X3DSchemaValidator.create(sources);
});

afterAll(() => validator?.dispose());

describe("X3D 4.0 XSD validation", () => {
  it("accepts a valid scene", () => {
    const r = validator.validate(fixture("hello.x3d"));
    expect(r.issues).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("reports unknown nodes and misspelled attributes with line numbers", () => {
    const r = validator.validate(fixture("bad-schema.x3d"));
    expect(r.ok).toBe(false);
    const text = r.issues.map((i) => i.message).join("\n");
    expect(text).toMatch(/difuseColor/);
    expect(text).toMatch(/Cube/);
    expect(r.issues.every((i) => typeof i.line === "number" && i.line > 0)).toBe(true);
  });

  it("reports malformed XML as a parse error", () => {
    const r = validator.validate("<X3D><Scene></X3D>");
    expect(r.ok).toBe(false);
    expect(r.issues.length).toBeGreaterThan(0);
  });
});
