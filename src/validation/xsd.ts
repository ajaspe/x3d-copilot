/**
 * XSD validation of X3D documents against the official X3D 4.0 XML Schema,
 * running entirely in WebAssembly (libxml2-wasm) - works in browsers and Node.
 *
 * The X3D schema is split across several files and imports the W3C
 * xmldsig schema, so we feed all of them through an in-memory input provider
 * keyed by the exact schemaLocation strings used in x3d-4.0.xsd.
 */
import {
  XmlDocument,
  XsdValidator,
  XmlValidateError,
  XmlParseError,
  XmlBufferInputProvider,
  xmlRegisterInputProvider,
  type ErrorDetail,
} from "libxml2-wasm";

export const X3D_SCHEMA_BASE = "https://www.web3d.org/specifications/";
export const X3D_SCHEMA_MAIN = "x3d-4.0.xsd";

/** Files the main schema pulls in, and the schemaLocation each is referenced by. */
export const X3D_SCHEMA_FILES: Record<string, string> = {
  "x3d-4.0.xsd": X3D_SCHEMA_BASE + "x3d-4.0.xsd",
  "x3d-4.0-Web3dExtensionsPublic.xsd": X3D_SCHEMA_BASE + "x3d-4.0-Web3dExtensionsPublic.xsd",
  "x3d-4.0-Web3dExtensionsPrivate.xsd": X3D_SCHEMA_BASE + "x3d-4.0-Web3dExtensionsPrivate.xsd",
  "xmldsig-core-schema.xsd": "http://www.w3.org/TR/2002/REC-xmldsig-core-20020212/xmldsig-core-schema.xsd",
};

export interface XsdIssue {
  message: string;
  line?: number;
  col?: number;
}

export interface XsdResult {
  ok: boolean;
  issues: XsdIssue[];
}

const encoder = new TextEncoder();

/**
 * Compiled X3D XSD validator. Create once (schema compilation takes a second),
 * then call `validate()` as often as you like.
 */
export class X3DSchemaValidator {
  private validator: XsdValidator;

  private constructor(validator: XsdValidator) {
    this.validator = validator;
  }

  /**
   * @param sources map of file name (keys of X3D_SCHEMA_FILES) -> schema XML text
   */
  static create(sources: Record<string, string>): X3DSchemaValidator {
    const buffers: Record<string, Uint8Array> = {};
    for (const [file, location] of Object.entries(X3D_SCHEMA_FILES)) {
      const text = sources[file];
      if (text === undefined) throw new Error(`Missing schema source: ${file}`);
      const bytes = encoder.encode(text);
      buffers[location] = bytes;
      buffers[file] = bytes;
    }
    xmlRegisterInputProvider(new XmlBufferInputProvider(buffers));

    const xsdDoc = XmlDocument.fromString(sources[X3D_SCHEMA_MAIN], {
      url: X3D_SCHEMA_FILES[X3D_SCHEMA_MAIN],
    });
    try {
      const validator = XsdValidator.fromDoc(xsdDoc);
      return new X3DSchemaValidator(validator);
    } finally {
      xsdDoc.dispose();
    }
  }

  validate(x3dXml: string): XsdResult {
    let doc: XmlDocument;
    try {
      doc = XmlDocument.fromString(x3dXml, { url: "scene.x3d" });
    } catch (e) {
      if (e instanceof XmlParseError) {
        return { ok: false, issues: detailsToIssues(e.details, "XML parse error") };
      }
      return { ok: false, issues: [{ message: `XML parse error: ${(e as Error).message}` }] };
    }
    try {
      this.validator.validate(doc);
      return { ok: true, issues: [] };
    } catch (e) {
      if (e instanceof XmlValidateError) {
        return { ok: false, issues: detailsToIssues(e.details, "Schema") };
      }
      return { ok: false, issues: [{ message: `Schema validation failed: ${(e as Error).message}` }] };
    } finally {
      doc.dispose();
    }
  }

  dispose(): void {
    this.validator.dispose();
  }
}

function detailsToIssues(details: ErrorDetail[] | undefined, prefix: string): XsdIssue[] {
  if (!details || details.length === 0) return [{ message: `${prefix}: invalid document` }];
  return details.map((d) => ({
    message: cleanMessage(d.message),
    line: d.line,
    col: d.col,
  }));
}

function cleanMessage(msg: string): string {
  return msg.replace(/\s+$/g, "").replace(/^Element '([^']+)'/, "<$1>");
}
