import { describe, it, expect } from "vitest";
import { applyEdits, formatReport } from "../src/ai/tools";

const src = `<X3D profile="Immersive" version="4.0">
  <Scene>
    <Shape><Box/></Shape>
    <Shape><Sphere/></Shape>
  </Scene>
</X3D>`;

describe("edit_scene text patching", () => {
  it("applies a unique replacement", () => {
    const r = applyEdits(src, [{ old: "<Box/>", new: '<Box size="2 2 2"/>' }]);
    expect(r.error).toBeUndefined();
    expect(r.text).toContain('<Box size="2 2 2"/>');
  });
  it("rejects ambiguous matches", () => {
    const r = applyEdits(src, [{ old: "<Shape>", new: "<Shape DEF='S'>" }]);
    expect(r.error).toMatch(/occurs 2 times/);
    expect(r.text).toBe(src);
  });
  it("rejects missing text with a hint", () => {
    const r = applyEdits(src, [{ old: "<Cone/>", new: "<Box/>" }]);
    expect(r.error).toMatch(/not found/);
  });
  it("inserts before an anchor", () => {
    const r = applyEdits(src, [{ old: "", new: "    <Viewpoint position='0 0 5'/>\n", anchor_before: "  </Scene>" }]);
    expect(r.error).toBeUndefined();
    expect(r.text.indexOf("<Viewpoint")).toBeLessThan(r.text.indexOf("</Scene>"));
  });
  it("applies edits sequentially and atomically", () => {
    const r = applyEdits(src, [
      { old: "<Box/>", new: "<Cone/>" },
      { old: "<Cone/>", new: "<Cylinder/>" },
      { old: "<Nope/>", new: "" },
    ]);
    expect(r.error).toBeDefined();
    expect(r.text).toBe(src); // nothing applied when any edit fails
  });
});

describe("report formatting", () => {
  it("summarises counts, issues and render status", () => {
    const text = formatReport({
      lines: 12,
      schemaChecked: true,
      issues: [
        { severity: "error", message: "bad", line: 3, source: "lint", rule: "x" },
        { severity: "info", message: "hint", line: 4, source: "lint", rule: "y" },
      ],
      runtime: { ok: false, errors: ["boom"], warnings: [], ms: 10 },
    });
    expect(text).toMatch(/1 error\(s\), 0 warning\(s\), 1 hint\(s\) \[XSD checked\]/);
    expect(text).toContain("L3 bad");
    expect(text).not.toContain("L4 hint"); // hints hidden by default
    expect(text).toContain("Render: FAILED in X_ITE: boom");
  });
});
