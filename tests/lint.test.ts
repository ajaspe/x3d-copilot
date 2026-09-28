import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { lintX3D } from "../src/validation/lint";
import { isA, acceptsNode, describeNode, searchNodes, getNode, suggest } from "../src/spec/uom";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => readFileSync(join(here, "fixtures", name), "utf8");

const wrap = (scene: string, extra = 'profile="Immersive" version="4.0"') =>
  `<?xml version="1.0" encoding="UTF-8"?><X3D ${extra}><head/><Scene>${scene}</Scene></X3D>`;

const rules = (xml: string) => lintX3D(xml).map((i) => i.rule);
const errors = (xml: string) => lintX3D(xml).filter((i) => i.severity === "error");

describe("spec database (X3DUOM)", () => {
  it("knows the type hierarchy", () => {
    expect(isA("Box", "X3DGeometryNode")).toBe(true);
    expect(isA("Transform", "X3DGroupingNode")).toBe(true);
    expect(isA("Transform", "X3DBoundedObject")).toBe(true);
    expect(isA("Material", "X3DGeometryNode")).toBe(false);
    expect(acceptsNode(["X3DAppearanceNode"], "Appearance")).toBe(true);
    expect(acceptsNode(["X3DChildNode"], "Material")).toBe(false);
  });
  it("describes nodes with fields from the spec", () => {
    const d = describeNode("Box")!;
    expect(d).toContain("size: SFVec3f initializeOnly");
    expect(d).toContain('default="2 2 2"');
    expect(d).toContain("containerField: geometry");
  });
  it("searches nodes", () => {
    expect(searchNodes("interpolator").map((n) => n.name)).toContain("PositionInterpolator");
    expect(getNode("PhysicalMaterial")).toBeDefined();
  });
  it("suggests corrections", () => {
    expect(suggest("Cube", ["Box", "Cone", "Cylinder", "Sphere"])).toBe("Cone");
    expect(suggest("Sphre", ["Box", "Cone", "Cylinder", "Sphere"])).toBe("Sphere");
  });
});

describe("linter", () => {
  it("accepts the hello fixture with at most info-level notes", () => {
    const issues = lintX3D(fixture("hello.x3d"));
    expect(issues.filter((i) => i.severity !== "info")).toEqual([]);
  });

  it("reports malformed XML with a line", () => {
    const issues = lintX3D("<X3D>\n<Scene>\n</X3D>");
    expect(issues[0].source).toBe("xml");
    expect(issues[0].line).toBeGreaterThan(0);
  });

  it("flags unknown nodes with suggestions", () => {
    const issues = errors(wrap("<Shape><Sphre radius='1'/></Shape>"));
    expect(issues.some((i) => i.rule === "node/unknown" && i.message.includes("<Sphere>"))).toBe(true);
  });

  it("flags unknown fields with suggestions", () => {
    const issues = errors(wrap("<Shape><Appearance><Material difuseColor='1 0 0'/></Appearance><Box/></Shape>"));
    const f = issues.find((i) => i.rule === "field/unknown")!;
    expect(f.message).toContain("diffuseColor");
    expect(f.hint).toBe("diffuseColor");
  });

  it("flags duplicate DEF and undefined USE", () => {
    const r = rules(wrap("<Transform DEF='A'><Shape><Box/></Shape></Transform><Transform DEF='A'/><Shape USE='B'/>"));
    expect(r).toContain("def/duplicate");
    expect(r).toContain("use/undefined");
  });

  it("flags USE with a different node type", () => {
    const r = rules(wrap("<Shape DEF='S'><Box/></Shape><Transform USE='S'/>"));
    expect(r).toContain("use/type-mismatch");
  });

  it("validates ROUTEs: unknown node, unknown field, access type, field type", () => {
    const xml = wrap(`
      <Transform DEF='T'><Shape><Box/></Shape></Transform>
      <TimeSensor DEF='Clock' loop='true'/>
      <PositionInterpolator DEF='PI' key='0 1' keyValue='0 0 0 1 1 1'/>
      <ROUTE fromNode='Clok' fromField='fraction_changed' toNode='PI' toField='set_fraction'/>
      <ROUTE fromNode='Clock' fromField='fraction' toNode='PI' toField='set_fraction'/>
      <ROUTE fromNode='Clock' fromField='fraction_changed' toNode='PI' toField='bogus'/>
      <ROUTE fromNode='PI' fromField='value_changed' toNode='T' toField='rotation'/>
      <ROUTE fromNode='Clock' fromField='loop' toNode='T' toField='translation'/>
      <ROUTE fromNode='PI' fromField='set_fraction' toNode='T' toField='translation'/>
      <ROUTE fromNode='PI' fromField='value_changed' toNode='T' toField='translation'/>
    `);
    const issues = lintX3D(xml);
    const r = issues.map((i) => i.rule);
    expect(r.filter((x) => x === "route/unknown-node").length).toBe(1);
    expect(r).toContain("route/unknown-field");
    expect(r).toContain("route/type-mismatch"); // SFVec3f -> SFRotation and SFBool -> SFVec3f
    expect(r).toContain("route/not-output"); // set_fraction is inputOnly
    // 'fraction' is not a legal alias of the outputOnly field fraction_changed -> unknown field with a suggestion
    const unknownFields = issues.filter((i) => i.rule === "route/unknown-field");
    expect(unknownFields.length).toBe(2);
    expect(unknownFields.some((i) => i.hint === "fraction_changed")).toBe(true);
    // the last, correct route produces nothing
  });

  it("accepts set_/_changed aliases only for inputOutput fields", () => {
    const xml = wrap(`
      <Transform DEF='T'><Shape><Box/></Shape></Transform>
      <PositionInterpolator DEF='PI' key='0 1' keyValue='0 0 0 1 1 1'/>
      <ROUTE fromNode='PI' fromField='value_changed' toNode='T' toField='set_translation'/>
      <ROUTE fromNode='T' fromField='translation_changed' toNode='T' toField='translation'/>
      <ROUTE fromNode='PI' fromField='value' toNode='T' toField='translation'/>`);
    const issues = lintX3D(xml).filter((i) => i.rule?.startsWith("route/"));
    expect(issues.length).toBe(1);
    expect(issues[0].message).toContain("'value'");
  });

  it("flags wrong placement (Material directly in Shape, Box outside Shape)", () => {
    const issues = errors(wrap("<Shape><Material diffuseColor='1 0 0'/><Box/></Shape><Box/>"));
    expect(issues.some((i) => i.rule === "placement/no-such-field" && i.message.includes("<Appearance>"))).toBe(true);
    expect(issues.some((i) => i.rule === "placement/scene-child")).toBe(true);
  });

  it("flags SFNode fields with multiple children", () => {
    const r = rules(wrap("<Shape><Box/><Sphere/></Shape>"));
    expect(r).toContain("placement/sfnode-multiple");
  });

  it("warns on Shape without geometry and empty groups", () => {
    const r = rules(wrap("<Shape><Appearance><Material/></Appearance></Shape><Group DEF='G'/>"));
    expect(r).toContain("shape/no-geometry");
    expect(r).toContain("group/empty");
  });

  it("checks attribute value types and arity", () => {
    const issues = lintX3D(wrap(`
      <Transform translation='1 2' rotation='0 0 0 1.57' scale='a b c'>
        <Shape><Appearance><Material diffuseColor='1 2 0' transparency='1.5'/></Appearance><Box solid='True'/></Shape>
      </Transform>`));
    const r = issues.map((i) => i.rule);
    expect(r).toContain("value/arity");
    expect(r).toContain("value/rotation-axis");
    expect(r).toContain("value/number");
    expect(r).toContain("value/color-range");
    expect(r).toContain("value/bool");
    expect(r).toContain("value/range");
  });

  it("rejects node fields written as attributes and event fields as attributes", () => {
    const r = rules(wrap("<Shape geometry='Box'><Box/></Shape><TimeSensor DEF='T' fraction_changed='0.5'/>"));
    expect(r).toContain("field/node-as-attribute");
    expect(r).toContain("field/event-as-attribute");
  });

  it("checks interpolator key/keyValue consistency", () => {
    const r = rules(wrap(`
      <PositionInterpolator DEF='A' key='0 0.5 1' keyValue='0 0 0 1 1 1'/>
      <OrientationInterpolator DEF='B' key='0 1 0.5' keyValue='0 1 0 0 0 1 0 1 0 1 0 2'/>
      <ScalarInterpolator DEF='C' key='0 1' keyValue='0 1'/>`));
    expect(r).toContain("interp/count-mismatch");
    expect(r).toContain("interp/key-order");
    expect(r.filter((x) => x === "interp/count-mismatch").length).toBe(1);
  });

  it("checks the X3D root element", () => {
    const r = rules(`<X3D><Scene/></X3D>`);
    expect(r).toContain("root/version");
    expect(r).toContain("root/profile");
    expect(rules(`<X3D profile="Imersive" version="4.0"><Scene/></X3D>`)).toContain("root/profile");
  });

  it("hints when there is no Viewpoint", () => {
    expect(rules(wrap("<Shape><Box/></Shape>"))).toContain("scene/no-viewpoint");
    expect(rules(wrap("<Viewpoint position='0 0 5'/><Shape><Box/></Shape>"))).not.toContain("scene/no-viewpoint");
  });

  it("handles ProtoDeclare / ProtoInstance", () => {
    const xml = wrap(`
      <ProtoDeclare name='Thing'><ProtoInterface><field name='c' type='SFColor' accessType='inputOutput' value='1 0 0'/></ProtoInterface>
        <ProtoBody><Shape><Appearance><Material DEF='M'><IS><connect nodeField='diffuseColor' protoField='c'/></IS></Material></Appearance><Box/></Shape></ProtoBody></ProtoDeclare>
      <ProtoInstance name='Thing'><fieldValue name='c' value='0 1 0'/></ProtoInstance>
      <ProtoInstance name='Other'/>`);
    const r = rules(xml);
    expect(r).toContain("proto/unknown-instance");
    expect(r.filter((x) => x?.startsWith("node/") || x?.startsWith("placement/"))).toEqual([]);
  });
});
