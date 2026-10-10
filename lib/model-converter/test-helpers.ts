import JSZip from "jszip";

/** Test-only builders for synthetic STL/3MF files. */

export interface TestMesh {
  positions: number[];
  indices: number[];
}

/** Axis-aligned box from `min` to `max`, outward-facing triangles. */
export function box(
  min: [number, number, number],
  max: [number, number, number],
): TestMesh {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  // prettier-ignore
  const positions = [
    x0, y0, z0,  x1, y0, z0,  x1, y1, z0,  x0, y1, z0,
    x0, y0, z1,  x1, y0, z1,  x1, y1, z1,  x0, y1, z1,
  ];
  // prettier-ignore
  const indices = [
    0, 2, 1,  0, 3, 2, // bottom (-z)
    4, 5, 6,  4, 6, 7, // top (+z)
    0, 1, 5,  0, 5, 4, // -y
    2, 3, 7,  2, 7, 6, // +y
    1, 2, 6,  1, 6, 5, // +x
    3, 0, 4,  3, 4, 7, // -x
  ];
  return { positions, indices };
}

/** UV sphere; triangle count is `2 * segments * (rings - 1)`. */
export function sphere(
  radius: number,
  segments: number,
  rings: number,
): TestMesh {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let r = 0; r <= rings; r++) {
    const theta = (r / rings) * Math.PI;
    for (let s = 0; s <= segments; s++) {
      const phi = (s / segments) * Math.PI * 2;
      positions.push(
        radius * Math.sin(theta) * Math.cos(phi),
        radius * Math.sin(theta) * Math.sin(phi),
        radius * Math.cos(theta),
      );
    }
  }
  const row = segments + 1;
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const a = r * row + s;
      const b = a + row;
      if (r > 0) indices.push(a, b, a + 1);
      if (r < rings - 1) indices.push(a + 1, b, b + 1);
    }
  }
  return { positions, indices };
}

export function binaryStl(mesh: TestMesh): ArrayBuffer {
  const triangles = mesh.indices.length / 3;
  const buffer = new ArrayBuffer(84 + triangles * 50);
  const view = new DataView(buffer);
  view.setUint32(80, triangles, true);
  let offset = 84;
  for (let t = 0; t < triangles; t++) {
    offset += 12; // normal (unused by readers)
    for (let v = 0; v < 3; v++) {
      const i = mesh.indices[t * 3 + v] * 3;
      for (let axis = 0; axis < 3; axis++) {
        view.setFloat32(offset, mesh.positions[i + axis], true);
        offset += 4;
      }
    }
    offset += 2;
  }
  return buffer;
}

export function asciiStl(mesh: TestMesh): ArrayBuffer {
  const lines = ["solid test"];
  for (let t = 0; t < mesh.indices.length; t += 3) {
    lines.push(" facet normal 0 0 0", "  outer loop");
    for (let v = 0; v < 3; v++) {
      const i = mesh.indices[t + v] * 3;
      lines.push(`   vertex ${mesh.positions.slice(i, i + 3).join(" ")}`);
    }
    lines.push("  endloop", " endfacet");
  }
  lines.push("endsolid test");
  return new TextEncoder().encode(lines.join("\n")).buffer as ArrayBuffer;
}

export function meshXml(
  mesh: TestMesh,
  triangleAttrs: (t: number) => string = () => "",
): string {
  const vertices: string[] = [];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const [x, y, z] = mesh.positions.slice(i, i + 3);
    vertices.push(`<vertex x="${x}" y="${y}" z="${z}"/>`);
  }
  const triangles: string[] = [];
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const [a, b, c] = mesh.indices.slice(t, t + 3);
    triangles.push(
      `<triangle v1="${a}" v2="${b}" v3="${c}"${triangleAttrs(t / 3)}/>`,
    );
  }
  return `<mesh><vertices>${vertices.join("")}</vertices><triangles>${triangles.join("")}</triangles></mesh>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;

export function modelXml(body: string, unit = "millimeter"): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="${unit}" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p">
${body}
</model>`;
}

/** Zips the given entries (path → text) into a 3MF package. */
export async function make3mf(
  files: Record<string, string>,
): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.file("_rels/.rels", RELS);
  for (const [path, text] of Object.entries(files)) zip.file(path, text);
  return zip.generateAsync({ type: "arraybuffer" });
}
