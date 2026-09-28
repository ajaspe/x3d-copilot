import { describe, it, expect } from "vitest";
import { downgradeTo40 } from "../src/validation/downgrade";
import { lintX3D } from "../src/validation/lint";

describe("downgrade X_ITE 4.1 output to X3D 4.0", () => {
  it("sets the version and strips 4.1-only attributes", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<X3D profile="Interchange" version="4.1">
  <Scene>
    <Shape>
      <Appearance><PhysicalMaterial baseColor="1 0 0"><ImageTexture url='"a.png"' colorSpaceConversion="true" containerField="baseTexture"/></PhysicalMaterial></Appearance>
      <Box/>
    </Shape>
  </Scene>
</X3D>`;
    const r = downgradeTo40(xml);
    expect(r.versionChanged).toBe(true);
    expect(r.removed).toEqual([{ node: "ImageTexture", attr: "colorSpaceConversion", count: 1 }]);
    expect(r.xml).toContain('version="4.0"');
    expect(r.xml).not.toContain("colorSpaceConversion");
    expect(r.xml).toContain('containerField="baseTexture"');
    expect(lintX3D(r.xml).filter((i) => i.severity === "error")).toEqual([]);
  });
  it("leaves already-valid 4.0 documents untouched", () => {
    const xml = `<X3D profile="Immersive" version="4.0"><Scene><Shape><Box/></Shape></Scene></X3D>`;
    const r = downgradeTo40(xml);
    expect(r.xml).toBe(xml);
    expect(r.removed).toEqual([]);
  });
});
