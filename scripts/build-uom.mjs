/**
 * Build a compact JSON spec database from the official X3D Unified Object Model
 * (X3DUOM 4.0, https://www.web3d.org/specifications/X3dUnifiedObjectModel-4.0.xml).
 *
 * Output: src/generated/x3duom.json - consumed by the semantic linter, the
 * editor autocompletion and the AI's `lookup_node` tool.
 *
 * Run: node scripts/build-uom.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { XmlDocument } from "libxml2-wasm";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const src = join(root, "spec", "X3dUnifiedObjectModel-4.0.xml");
const out = join(root, "src", "generated", "x3duom.json");

const xml = readFileSync(src, "utf8");
const doc = XmlDocument.fromString(xml);

const attr = (el, name) => el.attr(name)?.value ?? undefined;
const children = (el, name) => el.find(`./${name}`);

function readFields(iface) {
  const fields = {};
  for (const f of children(iface, "field")) {
    const name = attr(f, "name");
    const entry = {
      t: attr(f, "type"),
      a: attr(f, "accessType"),
    };
    const d = attr(f, "default");
    if (d !== undefined) entry.d = d;
    const ant = attr(f, "acceptableNodeTypes");
    if (ant) entry.n = ant.split(/[\s|]+/).filter(Boolean);
    const inh = attr(f, "inheritedFrom");
    if (inh) entry.i = inh;
    const use = attr(f, "use");
    if (use === "required") entry.r = true;
    const min = attr(f, "minInclusive") ?? attr(f, "minExclusive");
    const max = attr(f, "maxInclusive") ?? attr(f, "maxExclusive");
    if (min !== undefined) entry.min = min;
    if (max !== undefined) entry.max = max;
    const desc = attr(f, "description");
    // Descriptions of the boilerplate fields are identical everywhere - drop them.
    if (desc && !["DEF", "USE", "class", "id", "style", "IS", "metadata"].includes(name)) {
      entry.desc = desc.replace(/\s+/g, " ").trim();
    }
    const simpleType = attr(f, "simpleType");
    if (simpleType) entry.enum = simpleType;
    fields[name] = entry;
  }
  return fields;
}

function readInterface(node) {
  const iface = children(node, "InterfaceDefinition")[0];
  const comp = children(iface, "componentInfo")[0];
  const inh = children(iface, "Inheritance")[0];
  const addInh = children(iface, "AdditionalInheritance").map((n) => attr(n, "baseType"));
  const cf = children(iface, "containerField")[0];
  const entry = {
    component: comp ? attr(comp, "name") : undefined,
    level: comp ? Number(attr(comp, "level")) : undefined,
    base: inh ? attr(inh, "baseType") : undefined,
    implements: addInh.length ? addInh : undefined,
    url: attr(iface, "specificationUrl"),
    info: attr(iface, "appinfo")?.replace(/\s+/g, " ").trim(),
    containerField: cf ? attr(cf, "default") : undefined,
    containerFieldType: cf ? attr(cf, "type") : undefined,
    fields: readFields(iface),
  };
  for (const k of Object.keys(entry)) if (entry[k] === undefined) delete entry[k];
  return entry;
}

// Simple type enumerations (containerField choices, componentNameChoices, etc.)
const enums = {};
for (const st of doc.root.find("./SimpleTypeEnumerations/SimpleType")) {
  const name = attr(st, "name");
  const values = children(st, "enumeration").map((e) => attr(e, "value")).filter((v) => v !== undefined);
  if (values.length) enums[name] = values;
}

const abstract = {};
for (const n of doc.root.find("./AbstractNodeTypes/AbstractNodeType")) abstract[attr(n, "name")] = readInterface(n);
for (const n of doc.root.find("./AbstractObjectTypes/AbstractObjectType")) abstract[attr(n, "name")] = readInterface(n);

const nodes = {};
for (const n of doc.root.find("./ConcreteNodes/ConcreteNode")) nodes[attr(n, "name")] = readInterface(n);

const statements = {};
for (const n of doc.root.find("./Statements/Statement")) statements[attr(n, "name")] = readInterface(n);

// Resolve containerField alternates from the enumeration type
for (const entry of Object.values(nodes)) {
  if (entry.containerFieldType && enums[entry.containerFieldType]) {
    entry.containerFields = enums[entry.containerFieldType];
  }
  delete entry.containerFieldType;
}

const fieldTypes = doc.root.find("./FieldTypes/FieldType").map((f) => attr(f, "type")).filter(Boolean);

const db = {
  version: attr(doc.root, "version") ?? "4.0",
  source: "https://www.web3d.org/specifications/X3dUnifiedObjectModel-4.0.xml",
  fieldTypes,
  enums: Object.fromEntries(Object.entries(enums).filter(([k]) => /^containerFieldChoices|componentNameChoices|profileNameChoices|accessTypeChoices/.test(k))),
  abstract,
  nodes,
  statements,
};

doc.dispose();
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(db));
console.log(`nodes=${Object.keys(nodes).length} abstract=${Object.keys(abstract).length} statements=${Object.keys(statements).length} fieldTypes=${fieldTypes.length} bytes=${JSON.stringify(db).length}`);
