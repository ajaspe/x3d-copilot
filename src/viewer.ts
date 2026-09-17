/**
 * Thin wrapper around the X_ITE X3D browser: load scenes from text, capture
 * runtime warnings/errors, take screenshots, convert other 3D formats to X3D.
 */
import type X3DNS from "x_ite";

export type X3DModule = typeof X3DNS;

/**
 * X_ITE loads its components, fonts and images relative to its own script URL,
 * so it cannot be bundled. We serve the distribution from public/vendor/x_ite
 * (see scripts/vendor-x_ite.mjs) and import it at runtime.
 */
export async function loadX3D(baseUrl: string): Promise<X3DModule> {
  const url = new URL(`${baseUrl}vendor/x_ite/x_ite.min.mjs`, document.baseURI).href;
  const mod = (await import(/* @vite-ignore */ url)) as { default: X3DModule };
  return mod.default;
}

export interface RuntimeReport {
  ok: boolean;
  errors: string[];
  warnings: string[];
  /** wall-clock ms for parse + first frame */
  ms: number;
}

export type ShadingMode = "POINT" | "WIREFRAME" | "FLAT" | "GOURAUD" | "PHONG";

const IGNORED_WARNINGS = [/THREE\./, /favicon/i, /^\s*$/];

export class Viewer {
  readonly canvas: X3DNS.X3DCanvasElement;
  readonly browser: X3DNS.X3DBrowser;
  private loading = 0;
  ready: Promise<void>;

  constructor(private X3D: X3DModule, canvas: HTMLElement) {
    this.canvas = canvas as X3DNS.X3DCanvasElement;
    this.browser = X3D.getBrowser(this.canvas);
    this.ready = X3D();
  }

  /** Node type names implemented by this X_ITE build. */
  supportedNodes(): Set<string> {
    const set = new Set<string>();
    const nodes = this.browser.concreteNodes;
    for (let i = 0; i < nodes.length; i++) set.add(nodes[i].typeName);
    return set;
  }

  get version(): string {
    return this.browser.version;
  }

  /** Replace the world with the given X3D (XML, VRML classic or JSON) text. */
  async loadScene(text: string): Promise<RuntimeReport> {
    await this.ready;
    const id = ++this.loading;
    const t0 = performance.now();
    const cap = captureConsole();
    const errors: string[] = [];
    try {
      const scene = await this.browser.createX3DFromString(text);
      if (id !== this.loading) return { ok: true, errors: [], warnings: [], ms: 0 }; // superseded
      await this.browser.replaceWorld(scene);
      await this.browser.nextFrame();
      // give async resources (textures, Inline, fonts) a moment to report problems
      await sleep(250);
    } catch (e) {
      errors.push(cleanError(e));
    } finally {
      cap.restore();
    }
    const warnings = cap.warnings.filter((w) => !IGNORED_WARNINGS.some((re) => re.test(w)));
    errors.push(...cap.errors.filter((w) => !IGNORED_WARNINGS.some((re) => re.test(w))));
    return { ok: errors.length === 0, errors: dedupe(errors), warnings: dedupe(warnings), ms: Math.round(performance.now() - t0) };
  }

  viewAll(): void {
    try {
      this.browser.viewAll(undefined, 0.6);
    } catch {
      /* no active layer yet */
    }
  }

  setShading(mode: ShadingMode): void {
    this.browser.setBrowserOption("Shading", mode);
  }

  /** PNG data URL of the current view (X_ITE re-renders for this call). */
  async screenshot(maxWidth = 1024): Promise<string> {
    await this.browser.nextFrame();
    const dataUrl = this.canvas.toDataURL("image/png");
    return downscale(dataUrl, maxWidth);
  }

  /** Canonical X3D XML of the currently loaded scene (as X_ITE understands it). */
  toXML(): string {
    return this.browser.currentScene.toXMLString();
  }
  toVRML(): string {
    return this.browser.currentScene.toVRMLString();
  }
  toJSON(): string {
    return this.browser.currentScene.toJSONString();
  }

  /**
   * Convert a 3D file X_ITE can read (glTF/GLB, OBJ, STL, PLY, SVG, VRML, X3D JSON…)
   * into X3D XML by loading it into a scratch scene and serialising it back.
   */
  async convertFileToX3D(file: File): Promise<string> {
    await this.ready;
    const url = URL.createObjectURL(file);
    try {
      // Give X_ITE a filename hint for format sniffing by appending a fragment-free suffix via a data URL fallback.
      const scene = await this.browser.createX3DFromURL(new this.X3D.MFString(url + "#." + ext(file.name)));
      scene.setMetaData?.("title", file.name);
      let xml = scene.toXMLString();
      xml = xml.replace(/<X3D([^>]*)>/, (m) => (m.includes("version=") ? m : `<X3D profile="Full" version="4.0"$1>`));
      return xml;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

}

function ext(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : "x3d";
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}

function cleanError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.replace(/^Error:\s*/, "").split("\n").slice(0, 6).join("\n").trim() || "Unknown error while loading scene";
}

function captureConsole() {
  const warnings: string[] = [];
  const errors: string[] = [];
  const ow = console.warn;
  const oe = console.error;
  const fmt = (args: unknown[]) => args.map((a) => (a instanceof Error ? a.message : typeof a === "string" ? a : safeJson(a))).join(" ").trim();
  console.warn = (...args: unknown[]) => {
    warnings.push(fmt(args));
    ow.apply(console, args);
  };
  console.error = (...args: unknown[]) => {
    errors.push(fmt(args));
    oe.apply(console, args);
  };
  return {
    warnings,
    errors,
    restore() {
      console.warn = ow;
      console.error = oe;
    },
  };
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

async function downscale(dataUrl: string, maxWidth: number): Promise<string> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  if (img.width <= maxWidth) return dataUrl;
  const scale = maxWidth / img.width;
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}
