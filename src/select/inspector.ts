/** Floating inspector panel for the selected Transform. */
import { axisAngleToEulerDeg, eulerDegToAxisAngle, round, type AxisAngle, type Vec3 } from "./math";
import type { TransformState, GizmoMode } from "./gizmo";

export interface InspectorCallbacks {
  onChange(state: Partial<TransformState>, commit: boolean): void;
  onDeselect(): void;
  onSelectParent(): void;
  onGoToSource(): void;
  onModes(modes: Set<GizmoMode>): void;
  onAsk(): void;
}

export class Inspector {
  readonly el: HTMLElement;
  private title: HTMLElement;
  private inputs: Record<string, HTMLInputElement> = {};
  private modeButtons: Record<GizmoMode, HTMLButtonElement>;
  private modes = new Set<GizmoMode>(["move", "rotate", "scale"]);
  private uniform = true;
  private current: TransformState | null = null;

  constructor(parent: HTMLElement, private cb: InspectorCallbacks) {
    this.el = document.createElement("div");
    this.el.id = "inspector";
    this.el.className = "inspector hidden";
    this.el.innerHTML = `
      <div class="insp-head">
        <span class="insp-title"></span>
        <button class="ghost" data-act="parent" title="Select the enclosing Transform (Backspace)">↑ parent</button>
        <button class="ghost" data-act="source" title="Reveal in source">source</button>
        <button class="ghost" data-act="close" title="Deselect (Esc)">✕</button>
      </div>
      <div class="insp-modes">
        <button data-mode="move" class="on" title="Show move handles">Move</button>
        <button data-mode="rotate" class="on" title="Show rotation rings">Rotate</button>
        <button data-mode="scale" class="on" title="Show scale handle">Scale</button>
        <button class="ghost" data-act="ask" title="Ask the copilot about this node">ask AI</button>
      </div>
      <div class="insp-grid">
        <label>translation</label>${this.vec("t")}
        <label>rotation °</label>${this.vec("r")}
        <label>scale <input type="checkbox" data-uniform checked title="uniform scale"/></label>${this.vec("s")}
      </div>
      <div class="insp-foot muted">Drag the arrows, rings and cube in the view, or scrub the numbers (drag left/right, Shift = fine). Enter commits.</div>
    `;
    parent.appendChild(this.el);
    this.title = this.el.querySelector(".insp-title")!;
    for (const inp of this.el.querySelectorAll<HTMLInputElement>("input[data-k]")) {
      this.inputs[inp.dataset.k!] = inp;
      this.wireInput(inp);
    }
    this.modeButtons = {
      move: this.el.querySelector('[data-mode="move"]')!,
      rotate: this.el.querySelector('[data-mode="rotate"]')!,
      scale: this.el.querySelector('[data-mode="scale"]')!,
    };
    for (const [m, b] of Object.entries(this.modeButtons) as [GizmoMode, HTMLButtonElement][]) {
      b.addEventListener("click", () => {
        if (this.modes.has(m)) this.modes.delete(m);
        else this.modes.add(m);
        b.classList.toggle("on", this.modes.has(m));
        this.cb.onModes(new Set(this.modes));
      });
    }
    this.el.querySelector('[data-act="close"]')!.addEventListener("click", () => this.cb.onDeselect());
    this.el.querySelector('[data-act="parent"]')!.addEventListener("click", () => this.cb.onSelectParent());
    this.el.querySelector('[data-act="source"]')!.addEventListener("click", () => this.cb.onGoToSource());
    this.el.querySelector('[data-act="ask"]')!.addEventListener("click", () => this.cb.onAsk());
    this.el.querySelector<HTMLInputElement>("[data-uniform]")!.addEventListener("change", (ev) => {
      this.uniform = (ev.target as HTMLInputElement).checked;
    });
  }

  private vec(prefix: string): string {
    return ["x", "y", "z"].map((c) => `<input type="text" inputmode="decimal" data-k="${prefix}${c}" class="${c}" />`).join("");
  }

  private wireInput(inp: HTMLInputElement) {
    const k = inp.dataset.k!;
    const commit = () => {
      const st = this.readInputs();
      if (st) this.cb.onChange(st, true);
    };
    inp.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        commit();
        inp.blur();
      } else if (ev.key === "Escape") {
        inp.blur();
        this.cb.onDeselect();
      } else if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
        ev.preventDefault();
        const step = (ev.shiftKey ? 0.01 : k.startsWith("r") ? 5 : 0.1) * (ev.key === "ArrowUp" ? 1 : -1);
        inp.value = String(round((Number(inp.value) || 0) + step, 4));
        const st = this.readInputs();
        if (st) this.cb.onChange(st, false);
      }
    });
    inp.addEventListener("blur", commit);
    // scrub: drag horizontally to change the value
    inp.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      const startX = ev.clientX;
      const startV = Number(inp.value) || 0;
      let moved = false;
      const move = (e: PointerEvent) => {
        const dx = e.clientX - startX;
        if (!moved && Math.abs(dx) < 3) return;
        if (!moved) {
          moved = true;
          inp.setPointerCapture(ev.pointerId);
          inp.classList.add("scrub");
        }
        const unit = k.startsWith("r") ? 0.5 : k.startsWith("s") ? 0.01 : 0.02;
        const v = startV + dx * unit * (e.shiftKey ? 0.1 : 1);
        inp.value = String(round(v, 4));
        const st = this.readInputs();
        if (st) this.cb.onChange(st, false);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        inp.classList.remove("scrub");
        if (moved) {
          ev.preventDefault();
          commit();
        }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
  }

  private readInputs(): Partial<TransformState> | null {
    const g = (k: string) => Number(this.inputs[k].value.replace(",", "."));
    const t: Vec3 = [g("tx"), g("ty"), g("tz")];
    const e: Vec3 = [g("rx"), g("ry"), g("rz")];
    let s: Vec3 = [g("sx"), g("sy"), g("sz")];
    if ([...t, ...e, ...s].some((n) => !Number.isFinite(n))) return null;
    if (this.uniform && this.current) {
      // whichever component changed drives the others
      const prev = this.current.scale;
      const changed = [0, 1, 2].find((i) => Math.abs(s[i] - prev[i]) > 1e-9);
      if (changed !== undefined) s = [s[changed], s[changed], s[changed]];
    }
    const rotation: AxisAngle = eulerDegToAxisAngle(e);
    return { translation: t, rotation, scale: s };
  }

  show(label: string, line: number, state: TransformState) {
    this.title.textContent = `${label}  ·  line ${line}`;
    this.el.classList.remove("hidden");
    this.update(state);
  }

  hide() {
    this.el.classList.add("hidden");
    this.current = null;
  }

  update(state: TransformState) {
    this.current = state;
    if (document.activeElement && this.el.contains(document.activeElement) && (document.activeElement as HTMLElement).classList.contains("scrub")) return;
    const [tx, ty, tz] = state.translation.map((n) => round(n, 4));
    const [rx, ry, rz] = axisAngleToEulerDeg(state.rotation);
    const [sx, sy, sz] = state.scale.map((n) => round(n, 4));
    const set = (k: string, v: number) => {
      const inp = this.inputs[k];
      if (document.activeElement !== inp) inp.value = String(v);
    };
    set("tx", tx); set("ty", ty); set("tz", tz);
    set("rx", rx); set("ry", ry); set("rz", rz);
    set("sx", sx); set("sy", sy); set("sz", sz);
  }
}
