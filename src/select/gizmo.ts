/**
 * Runtime selection + transform gizmo built from X3D itself.
 *
 * After every scene load we walk the live scene graph through the SAI, list
 * the Transform nodes in document order (same rule as sourceMap.ts) and inject
 * an invisible TouchSensor into each so clicking geometry selects its innermost
 * Transform. Selecting a Transform inserts a gizmo group next to it (same
 * coordinate frame) made of PlaneSensors (move along X/Y/Z), CylinderSensors
 * (rotate about X/Y/Z) and a PlaneSensor cube (uniform scale). A ProximitySensor
 * reports the camera pose so the gizmo keeps a constant screen size and each
 * axis handle picks the tracking plane that faces the viewer.
 *
 * Nothing here touches the scene *source*: the injected nodes live only in the
 * X_ITE scene graph and are recreated on every reload.
 */
import type X3DNS from "x_ite";
import type { X3DModule } from "../viewer";
import { axisAngleToQuat, qmul, quatToAxisAngle, qrotate, type AxisAngle, type Vec3 } from "./math";

type AnyNode = X3DNS.SFNode & Record<string, any>;

export interface LiveTransform {
  node: AnyNode;
  /** parent node (or null for a root node) and the field it sits in */
  parent: AnyNode | null;
  parentField: string;
}

export interface TransformState {
  translation: Vec3;
  rotation: AxisAngle;
  scale: Vec3;
}

export type GizmoMode = "move" | "rotate" | "scale";

export interface SceneToolsEvents {
  onSelect(index: number | null): void;
  /** live transform change; commit=true when the drag ended */
  onTransform(index: number, state: TransformState, commit: boolean): void;
}

const USER_KEY = "x3d-copilot";
const VISIT_KEY = "x3d-copilot-visit";
const GIZMO_SCREEN_SIZE = 0.16; // fraction of the view distance
const POINTING_SENSORS = new Set(["TouchSensor", "PlaneSensor", "CylinderSensor", "SphereSensor"]);

/** SFNode wrappers may be distinct objects for the same node; compare by value. */
function same(a: AnyNode | null | undefined, b: AnyNode | null | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  try {
    return typeof a.equals === "function" ? a.equals(b) : false;
  } catch {
    return false;
  }
}

export class SceneTools {
  private transforms: LiveTransform[] = [];
  private scene: X3DNS.X3DScene | null = null;
  private selected: number | null = null;
  private gizmo: AnyNode | null = null;
  /** Group inserted in the parent's field: holds the camera sensor (parent frame) and the gizmo Transform */
  private gizmoRoot: AnyNode | null = null;
  private gizmoParentField: any = null;
  private gizmoActive = 0;
  private lastGizmoRelease = 0;
  private cbKey = {};
  private dragStart: TransformState | null = null;
  private cameraPos: Vec3 = [0, 0, 10];
  private handles: { node: AnyNode; axis: number; kind: "move" | "rotate"; alt: [AxisAngle, AxisAngle]; current: number }[] = [];
  modes = new Set<GizmoMode>(["move", "rotate", "scale"]);
  enabled = true;

  constructor(private X3D: X3DModule, private events: SceneToolsEvents) {}

  get count() {
    return this.transforms.length;
  }

  get selection() {
    return this.selected;
  }

  /** Call after every scene (re)load. */
  attach(scene: X3DNS.X3DScene) {
    this.scene = scene;
    this.selected = null;
    this.gizmo = null;
    this.gizmoRoot = null;
    this.gizmoParentField = null;
    this.transforms = [];
    this.handles = [];
    const token = Symbol("visit");
    const visit = (node: AnyNode, parent: AnyNode | null, field: string) => {
      if (!node) return;
      const typeName = node.getNodeTypeName();
      if (node.getNodeUserData(USER_KEY)) return; // our own injected nodes
      if (typeName === "Transform") {
        this.transforms.push({ node, parent, parentField: field });
      }
      if (node.getNodeUserData(VISIT_KEY) === token) return; // USE: count it but do not descend twice
      node.setNodeUserData(VISIT_KEY, token);
      if (typeName === "Transform" && this.enabled) this.injectSelector(node);
      if (node.getNodeType().includes(this.X3D.X3DConstants.X3DPrototypeInstance)) return;
      if (typeName === "Inline") return;
      const defs = node.getFieldDefinitions();
      for (let i = 0; i < defs.length; i++) {
        const d = defs[i];
        if (d.dataType === this.X3D.X3DConstants.MFNode) {
          const arr = node[d.name] as X3DNS.MFNode | undefined;
          if (!arr || !arr.length) continue;
          // copy: injecting sensors mutates children while iterating
          const items = Array.from(arr as unknown as Iterable<AnyNode>);
          for (const c of items) visit(c, node, d.name);
        } else if (d.dataType === this.X3D.X3DConstants.SFNode && d.name !== "metadata") {
          const c = node[d.name] as AnyNode | null;
          if (c) visit(c, node, d.name);
        }
      }
    };
    const roots = Array.from(scene.rootNodes as unknown as Iterable<AnyNode>);
    for (const r of roots) visit(r, null, "rootNodes");
  }

  private injectSelector(t: AnyNode) {
    // If the author already put a pointing-device sensor here, clicks belong to the scene's
    // own interaction; the Transform stays selectable from the editor cursor.
    const kids = Array.from((t.children ?? []) as Iterable<AnyNode>);
    if (kids.some((k) => k && POINTING_SENSORS.has(k.getNodeTypeName()))) return;
    const ts = this.scene!.createNode("TouchSensor") as AnyNode;
    ts.setNodeUserData(USER_KEY, "selector");
    ts.description = "Click to select this Transform";
    t.children.push(ts);
    ts.addFieldCallback(this.cbKey, "touchTime", () => {
      if (!this.enabled) return;
      if (this.gizmoActive > 0 || performance.now() - this.lastGizmoRelease < 150) return;
      // innermost sensor fires; select the first entry for this node (document order)
      const idx = this.transforms.findIndex((e) => same(e.node, t));
      if (idx >= 0) this.select(idx);
    });
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.select(null);
  }

  getState(index: number): TransformState | null {
    const e = this.transforms[index];
    if (!e) return null;
    const n = e.node;
    return {
      translation: [n.translation.x, n.translation.y, n.translation.z],
      rotation: [n.rotation.x, n.rotation.y, n.rotation.z, n.rotation.angle],
      scale: [n.scale.x, n.scale.y, n.scale.z],
    };
  }

  setState(index: number, s: Partial<TransformState>) {
    const e = this.transforms[index];
    if (!e) return;
    const X = this.X3D;
    if (s.translation) e.node.translation = new X.SFVec3f(...s.translation);
    if (s.rotation) e.node.rotation = new X.SFRotation(...s.rotation);
    if (s.scale) e.node.scale = new X.SFVec3f(...s.scale);
    if (this.gizmo && this.selected === index) this.syncGizmo();
  }

  select(index: number | null) {
    if (index !== null && !this.transforms[index]) index = null;
    if (index === this.selected) {
      this.events.onSelect(index);
      return;
    }
    this.removeGizmo();
    if (this.selected !== null) {
      const prev = this.transforms[this.selected];
      if (prev) prev.node.bboxDisplay = false;
    }
    this.selected = index;
    if (index !== null) {
      const e = this.transforms[index];
      e.node.bboxDisplay = true;
      this.createGizmo(e);
    }
    this.events.onSelect(index);
  }

  setModes(modes: Set<GizmoMode>) {
    this.modes = modes;
    if (this.selected !== null) {
      const idx = this.selected;
      this.removeGizmo();
      this.createGizmo(this.transforms[idx]);
    }
  }

  // ---------------------------------------------------------------------------
  // gizmo construction
  // ---------------------------------------------------------------------------
  private removeGizmo() {
    if (!this.gizmoRoot) return;
    const field = this.gizmoParentField;
    let i = -1;
    for (let k = 0; k < field.length; k++) {
      if (same(field[k], this.gizmoRoot)) {
        i = k;
        break;
      }
    }
    if (i >= 0) field.splice(i, 1);
    this.gizmo = null;
    this.gizmoRoot = null;
    this.gizmoParentField = null;
    this.handles = [];
  }

  private createGizmo(e: LiveTransform) {
    const X = this.X3D;
    const scene = this.scene!;
    const mk = <T extends keyof X3DNS.ConcreteNodeTypes>(type: T) => {
      const n = scene.createNode(type) as unknown as AnyNode;
      n.setNodeUserData(USER_KEY, "gizmo");
      return n;
    };
    const root = mk("Group");
    const g = mk("Transform");
    this.gizmoRoot = root;
    this.gizmo = g;

    // Camera tracking for constant screen size + plane selection. The sensor must live in the
    // *parent's* frame (not inside the scaled gizmo), otherwise its reports depend on the
    // gizmo scale and the update loop oscillates.
    const prox = mk("ProximitySensor");
    prox.size = new X.SFVec3f(1e6, 1e6, 1e6);
    prox.addFieldCallback(this.cbKey, "position_changed", (v: unknown) => {
      const p = v as X3DNS.SFVec3f;
      const next: Vec3 = [p.x, p.y, p.z];
      const moved = Math.hypot(next[0] - this.cameraPos[0], next[1] - this.cameraPos[1], next[2] - this.cameraPos[2]);
      this.cameraPos = next;
      if (moved > 1e-4) this.syncGizmo();
    });
    root.children.push(prox, g);

    const material = (rgb: Vec3, alpha = 0) => {
      const app = mk("Appearance");
      const m = mk("UnlitMaterial");
      m.emissiveColor = new X.SFColor(...rgb);
      m.transparency = alpha;
      app.material = m;
      return app;
    };
    const colors: Vec3[] = [
      [0.95, 0.25, 0.25],
      [0.35, 0.85, 0.3],
      [0.3, 0.55, 1],
    ];
    // rotations mapping the handle's local +X (move) / +Y (rotate) axis to world axis i,
    // two alternatives per axis so the tracking plane can face the camera.
    const moveAlts: [AxisAngle, AxisAngle][] = [
      [[0, 0, 1, 0], [1, 0, 0, Math.PI / 2]], // X: plane XY or XZ
      [[0, 0, 1, Math.PI / 2], [0.5773503, 0.5773503, 0.5773503, 2 * Math.PI / 3]], // Y: local X->Y; planes YX (via Rz90: X->Y,Y->-X) or YZ (X->Y,Y->Z)
      [[0, 1, 0, -Math.PI / 2], [0.5773503, 0.5773503, 0.5773503, -2 * Math.PI / 3]], // Z: local X->Z; planes ZY or ZX
    ];

    if (this.modes.has("move")) {
      for (let axis = 0; axis < 3; axis++) {
        const h = mk("Transform");
        h.rotation = new X.SFRotation(...moveAlts[axis][0]);
        const ps = mk("PlaneSensor");
        ps.autoOffset = false;
        ps.minPosition = new X.SFVec2f(-1e5, 0);
        ps.maxPosition = new X.SFVec2f(1e5, 0);
        ps.description = `Move along ${"XYZ"[axis]}`;
        h.children.push(ps);
        // arrow: shaft (cylinder along X) + cone tip
        const shaft = mk("Transform");
        shaft.translation = new X.SFVec3f(0.55, 0, 0);
        shaft.rotation = new X.SFRotation(0, 0, 1, -Math.PI / 2);
        const shShape = mk("Shape");
        shShape.appearance = material(colors[axis]);
        const cyl = mk("Cylinder");
        cyl.radius = 0.025;
        cyl.height = 0.9;
        shShape.geometry = cyl;
        shaft.children.push(shShape);
        const tip = mk("Transform");
        tip.translation = new X.SFVec3f(1.1, 0, 0);
        tip.rotation = new X.SFRotation(0, 0, 1, -Math.PI / 2);
        const tipShape = mk("Shape");
        tipShape.appearance = material(colors[axis]);
        const cone = mk("Cone");
        cone.bottomRadius = 0.09;
        cone.height = 0.28;
        tipShape.geometry = cone;
        tip.children.push(tipShape);
        h.children.push(shaft, tip);
        g.children.push(h);
        this.handles.push({ node: h, axis, kind: "move", alt: moveAlts[axis], current: 0 });
        this.wirePlaneSensor(ps, (dx) => {
          const s = this.dragStart!;
          const t: Vec3 = [...s.translation] as Vec3;
          t[axis] += dx;
          return { translation: t };
        });
      }
    }

    if (this.modes.has("rotate")) {
      // CylinderSensor rotates about its local Y; map local Y to world axis
      const rotAlts: AxisAngle[] = [
        [0, 0, 1, -Math.PI / 2], // Y -> X
        [0, 0, 1, 0], // Y -> Y
        [1, 0, 0, Math.PI / 2], // Y -> Z
      ];
      for (let axis = 0; axis < 3; axis++) {
        const h = mk("Transform");
        h.rotation = new X.SFRotation(...rotAlts[axis]);
        const cs = mk("CylinderSensor");
        cs.autoOffset = false;
        cs.description = `Rotate about ${"XYZ"[axis]}`;
        h.children.push(cs);
        const ring = mk("Shape");
        ring.appearance = material(colors[axis]);
        ring.geometry = this.makeRing(mk, 1.35, 0.02);
        h.children.push(ring);
        g.children.push(h);
        this.handles.push({ node: h, axis, kind: "rotate", alt: [rotAlts[axis], rotAlts[axis]], current: 0 });
        let start: TransformState | null = null;
        cs.addFieldCallback(this.cbKey, "isActive", (v: unknown) => {
          if (v) {
            this.gizmoActive++;
            start = this.getState(this.selected!);
            this.dragStart = start;
          } else {
            this.gizmoActive = Math.max(0, this.gizmoActive - 1);
            this.lastGizmoRelease = performance.now();
            if (this.selected !== null) this.events.onTransform(this.selected, this.getState(this.selected)!, true);
            start = null;
          }
        });
        cs.addFieldCallback(this.cbKey, "rotation_changed", (v: unknown) => {
          if (!start || this.selected === null) return;
          const r = v as X3DNS.SFRotation; // about local Y
          const worldAxis: Vec3 = [0, 0, 0];
          worldAxis[axis] = 1;
          const delta = axisAngleToQuat([worldAxis[0], worldAxis[1], worldAxis[2], r.angle * Math.sign(r.y || 1)]);
          const q = qmul(delta, axisAngleToQuat(start.rotation));
          const rot = quatToAxisAngle(q);
          this.setState(this.selected, { rotation: rot });
          this.events.onTransform(this.selected, this.getState(this.selected)!, false);
        });
      }
    }

    if (this.modes.has("scale")) {
      const h = mk("Transform");
      const ps = mk("PlaneSensor");
      ps.autoOffset = false;
      ps.minPosition = new X.SFVec2f(-1e5, 0);
      ps.maxPosition = new X.SFVec2f(1e5, 0);
      ps.description = "Drag to scale uniformly";
      h.children.push(ps);
      const cubeShape = mk("Shape");
      cubeShape.appearance = material([0.95, 0.85, 0.2]);
      const box = mk("Box");
      box.size = new X.SFVec3f(0.16, 0.16, 0.16);
      cubeShape.geometry = box;
      h.children.push(cubeShape);
      g.children.push(h);
      this.handles.push({ node: h, axis: 0, kind: "move", alt: moveAlts[0], current: 0 });
      this.wirePlaneSensor(ps, (dx) => {
        const s = this.dragStart!;
        const f = Math.max(0.01, 1 + dx / Math.max(1e-6, this.gizmoScale()));
        return { scale: [s.scale[0] * f, s.scale[1] * f, s.scale[2] * f] as Vec3 };
      });
    }

    // insert the gizmo next to the selected Transform, in the same frame
    const field = e.parent ? e.parent[e.parentField] : scene.rootNodes;
    this.gizmoParentField = field;
    field.push(root);
    this.syncGizmo();
  }

  private wirePlaneSensor(ps: AnyNode, compute: (dx: number) => Partial<TransformState>) {
    ps.addFieldCallback(this.cbKey, "isActive", (v: unknown) => {
      if (v) {
        this.gizmoActive++;
        this.dragStart = this.selected !== null ? this.getState(this.selected) : null;
      } else {
        this.gizmoActive = Math.max(0, this.gizmoActive - 1);
        this.lastGizmoRelease = performance.now();
        if (this.selected !== null) this.events.onTransform(this.selected, this.getState(this.selected)!, true);
        this.dragStart = null;
      }
    });
    ps.addFieldCallback(this.cbKey, "translation_changed", (v: unknown) => {
      if (!this.dragStart || this.selected === null) return;
      const t = v as X3DNS.SFVec3f; // local: (dx, 0, 0), scaled by the gizmo
      const dx = t.x * this.gizmoScale();
      this.setState(this.selected, compute(dx));
      this.events.onTransform(this.selected, this.getState(this.selected)!, false);
    });
  }

  private makeRing(mk: (t: "Extrusion") => AnyNode, radius: number, thickness: number) {
    const X = this.X3D;
    const ex = mk("Extrusion");
    const cross: X3DNS.SFVec2f[] = [];
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * 2 * Math.PI;
      cross.push(new X.SFVec2f(Math.cos(a) * thickness, Math.sin(a) * thickness));
    }
    const spine: X3DNS.SFVec3f[] = [];
    const n = 48;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * 2 * Math.PI;
      spine.push(new X.SFVec3f(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    ex.crossSection = X.MFVec2f.from(cross);
    ex.spine = X.MFVec3f.from(spine);
    ex.beginCap = false;
    ex.endCap = false;
    ex.solid = false;
    ex.creaseAngle = 1;
    return ex;
  }

  private gizmoScale(): number {
    if (!this.gizmo) return 1;
    return this.gizmo.scale.x as number;
  }

  /** Keep the gizmo on the selected node's origin, at constant screen size, with camera-facing planes. */
  private syncGizmo() {
    if (!this.gizmo || this.selected === null) return;
    const X = this.X3D;
    const e = this.transforms[this.selected];
    const t = e.node.translation;
    const origin: Vec3 = [t.x, t.y, t.z];
    const gt = this.gizmo.translation as X3DNS.SFVec3f;
    if (Math.abs(gt.x - origin[0]) > 1e-9 || Math.abs(gt.y - origin[1]) > 1e-9 || Math.abs(gt.z - origin[2]) > 1e-9) {
      this.gizmo.translation = new X.SFVec3f(...origin);
    }
    const view: Vec3 = [this.cameraPos[0] - origin[0], this.cameraPos[1] - origin[1], this.cameraPos[2] - origin[2]];
    const dist = Math.hypot(...view) || 1;
    const s = dist * GIZMO_SCREEN_SIZE;
    const cs = this.gizmo.scale.x as number;
    if (Math.abs(cs - s) / Math.max(cs, 1e-6) > 0.02) this.gizmo.scale = new X.SFVec3f(s, s, s);
    // choose, per move handle, the alternative whose plane normal is most aligned with the view
    // direction; only switch when the other plane is clearly better (hysteresis avoids flapping)
    for (const h of this.handles) {
      if (h.kind !== "move") continue;
      const dots = h.alt.map((r) => {
        const normal = qrotate(axisAngleToQuat(r), [0, 0, 1]); // plane normal = local Z
        return Math.abs((normal[0] * view[0] + normal[1] * view[1] + normal[2] * view[2]) / dist);
      });
      const cur = h.current;
      const other = 1 - cur;
      if (dots[other] > dots[cur] + 0.15) {
        h.current = other;
        h.node.rotation = new X.SFRotation(...h.alt[other]);
      }
    }
  }
}
