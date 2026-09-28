import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { xml } from "@codemirror/lang-xml";
import { listTransforms, transformAtPos, readValues, buildTransformChanges, describeEntry } from "../src/select/sourceMap";
import { axisAngleToEulerDeg, eulerDegToAxisAngle, axisAngleToQuat, quatToAxisAngle, qmul, qrotate } from "../src/select/math";

const doc = `<X3D profile="Immersive" version="4.0">
  <Scene>
    <Transform DEF="A" translation="1 2 3">
      <Transform rotation="0 1 0 1.5708">
        <Shape><Box/></Shape>
      </Transform>
      <Transform USE="B"/>
    </Transform>
    <ProtoDeclare name="P"><ProtoBody><Transform DEF="Inner"/></ProtoBody></ProtoDeclare>
    <ProtoInstance name="P"><fieldValue name="x"><Transform/></fieldValue></ProtoInstance>
    <Transform DEF="B" scale="2 2 2"/>
  </Scene>
</X3D>`;

function state(text = doc) {
  return EditorState.create({ doc: text, extensions: [xml()] });
}

describe("source map of Transform elements", () => {
  it("lists transforms in document order, skipping proto bodies and fieldValues", () => {
    const list = listTransforms(state());
    expect(list.map(describeEntry)).toEqual(['Transform DEF="A"', "Transform #2", 'Transform USE="B"', 'Transform DEF="B"']);
    expect(list[1].parent).toBe(0);
    expect(list[3].parent).toBe(-1);
    expect(list[0].line).toBe(3);
  });

  it("reads values with defaults", () => {
    const list = listTransforms(state());
    expect(readValues(list[0]).translation).toEqual([1, 2, 3]);
    expect(readValues(list[1]).rotation).toEqual([0, 1, 0, 1.5708]);
    expect(readValues(list[1]).scale).toEqual([1, 1, 1]);
  });

  it("finds the innermost transform at a position", () => {
    const s = state();
    const list = listTransforms(s);
    const pos = s.doc.toString().indexOf("<Box/>");
    expect(transformAtPos(list, pos)?.index).toBe(1);
    expect(transformAtPos(list, s.doc.toString().indexOf('DEF="A"'))?.index).toBe(0);
  });

  it("builds minimal attribute edits (update, insert, remove defaults)", () => {
    const s = state();
    const list = listTransforms(s);
    const changes = buildTransformChanges(list[1], { translation: [0.5, 0, 0], rotation: [0, 0, 1, 0], scale: [1, 1, 1] });
    const out = s.update({ changes }).state.doc.toString();
    expect(out).toContain('<Transform translation="0.5 0 0">');
    expect(out).not.toContain('rotation="0 1 0 1.5708"');
    // untouched element stays as-is
    expect(out).toContain('<Transform DEF="A" translation="1 2 3">');
  });

  it("updates existing values in place on self-closing tags", () => {
    const s = state();
    const list = listTransforms(s);
    const out = s.update({ changes: buildTransformChanges(list[3], { scale: [3, 3, 3], translation: [1, 1, 1] }) }).state.doc.toString();
    expect(out).toContain('<Transform DEF="B" scale="3 3 3" translation="1 1 1"/>');
  });
});

describe("selection rules", () => {
  it("Transforms with an authored pointing sensor are still listed in the source map (selectable from the editor)", () => {
    const s = state(`<X3D profile="Immersive" version="4.0"><Scene><Transform DEF="B"><Shape><Cone/></Shape><TouchSensor DEF="T"/></Transform></Scene></X3D>`);
    expect(listTransforms(s).map(describeEntry)).toEqual(['Transform DEF="B"']);
  });
});

describe("rotation math", () => {
  it("round-trips Euler degrees through axis-angle", () => {
    for (const e of [[0, 0, 0], [90, 0, 0], [10, 20, 30], [-45, 60, 120]] as [number, number, number][]) {
      const aa = eulerDegToAxisAngle(e);
      const back = axisAngleToEulerDeg(aa);
      for (let i = 0; i < 3; i++) expect(back[i]).toBeCloseTo(e[i], 2);
    }
  });
  it("composes rotations in parent frame", () => {
    const start = axisAngleToQuat([0, 1, 0, Math.PI / 2]);
    const delta = axisAngleToQuat([0, 0, 1, Math.PI / 2]);
    const q = qmul(delta, start);
    // rotate +X: start (about Y 90°) -> -Z ; then about Z 90° leaves -Z unchanged
    const v = qrotate(q, [1, 0, 0]);
    expect(v[2]).toBeCloseTo(-1, 6);
    expect(quatToAxisAngle(axisAngleToQuat([0, 1, 0, 0.3]))[3]).toBeCloseTo(0.3, 6);
  });
});
