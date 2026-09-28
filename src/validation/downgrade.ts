/**
 * Normalise X3D emitted by X_ITE (which targets the X3D 4.1 draft) to strict X3D 4.0:
 * sets version="4.0" and removes attributes that X3D 4.0 does not define for the
 * node (e.g. ImageTexture.colorSpaceConversion). Unknown nodes are left in place
 * (the linter reports them). Returns the new text and what was removed.
 */
import { XmlDocument, XmlElement, XmlTreeNode } from "libxml2-wasm";
import { getNode, UNIVERSAL_ATTRS } from "../spec/uom";

export interface DowngradeResult {
  xml: string;
  removed: { node: string; attr: string; count: number }[];
  versionChanged: boolean;
}

export function downgradeTo40(xml: string): DowngradeResult {
  let doc: XmlDocument;
  try {
    doc = XmlDocument.fromString(xml);
  } catch {
    return { xml, removed: [], versionChanged: false };
  }
  const removed = new Map<string, number>();
  let versionChanged = false;
  try {
    const root = doc.root;
    if (root.name === "X3D") {
      const v = root.attr("version");
      if (v && v.value !== "4.0" && /^4\./.test(v.value)) {
        v.value = "4.0";
        versionChanged = true;
      }
    }
    const walk = (el: XmlElement) => {
      const def = getNode(el.name);
      if (def) {
        for (const a of [...el.attrs]) {
          if (UNIVERSAL_ATTRS.has(a.name) || a.name.includes(":")) continue;
          if (!def.fields[a.name]) {
            const key = `${el.name}.${a.name}`;
            removed.set(key, (removed.get(key) ?? 0) + 1);
            a.remove();
          }
        }
      }
      let c: XmlTreeNode | null = el.firstChild;
      while (c) {
        if (c instanceof XmlElement) walk(c);
        c = c.next;
      }
    };
    walk(root);
    if (removed.size === 0 && !versionChanged) return { xml, removed: [], versionChanged: false };
    const out = doc.toString({ format: true });
    return {
      xml: out,
      removed: [...removed.entries()].map(([k, count]) => ({ node: k.split(".")[0], attr: k.split(".")[1], count })),
      versionChanged,
    };
  } finally {
    doc.dispose();
  }
}
