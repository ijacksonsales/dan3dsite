/** Edges sharper than this stay sharp; gentler curves are smoothed. */
export const CREASE_ANGLE_DEG = 40;

export interface IndexedMesh {
  positions: Float32Array<ArrayBuffer>;
  indices: Uint32Array<ArrayBuffer>;
}

export interface MeshWithNormals extends IndexedMesh {
  normals: Float32Array<ArrayBuffer>;
}

/**
 * Area-weighted vertex normals with a crease angle: each triangle corner
 * averages only the neighbouring faces within `creaseAngleDeg` of its own
 * face, so curved surfaces look smooth while a flat base or a sharp edge
 * stays crisp. Vertices on a crease are split (one copy per distinct normal);
 * everything else stays shared, so the mesh remains indexed.
 */
export function creasedNormals(
  { positions, indices }: IndexedMesh,
  creaseAngleDeg = CREASE_ANGLE_DEG,
): MeshWithNormals {
  const vertexCount = positions.length / 3;
  const triangleCount = indices.length / 3;
  const cosCrease = Math.cos((creaseAngleDeg * Math.PI) / 180);

  // Face normals: raw (length = 2 × area) and unit.
  const faceNormals = new Float32Array(indices.length);
  const faceUnit = new Float32Array(indices.length);
  for (let t = 0; t < triangleCount; t++) {
    const a = indices[t * 3] * 3;
    const b = indices[t * 3 + 1] * 3;
    const c = indices[t * 3 + 2] * 3;
    const abx = positions[b] - positions[a];
    const aby = positions[b + 1] - positions[a + 1];
    const abz = positions[b + 2] - positions[a + 2];
    const acx = positions[c] - positions[a];
    const acy = positions[c + 1] - positions[a + 1];
    const acz = positions[c + 2] - positions[a + 2];
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    const length = Math.hypot(nx, ny, nz) || 1;
    faceNormals.set([nx, ny, nz], t * 3);
    faceUnit.set([nx / length, ny / length, nz / length], t * 3);
  }

  // Vertex → incident faces (CSR layout).
  const offsets = new Uint32Array(vertexCount + 1);
  for (let i = 0; i < indices.length; i++) offsets[indices[i] + 1]++;
  for (let v = 0; v < vertexCount; v++) offsets[v + 1] += offsets[v];
  const cursor = offsets.slice(0, vertexCount);
  const incident = new Uint32Array(indices.length);
  for (let i = 0; i < indices.length; i++)
    incident[cursor[indices[i]]++] = Math.floor(i / 3);

  const outPositions: number[] = [];
  const outNormals: number[] = [];
  const outIndices = new Uint32Array(indices.length);
  // Per source vertex: the output vertices already created for it.
  const created = new Map<number, number[]>();

  for (let i = 0; i < indices.length; i++) {
    const v = indices[i];
    const t = Math.floor(i / 3);
    let nx = 0;
    let ny = 0;
    let nz = 0;
    for (let k = offsets[v]; k < offsets[v + 1]; k++) {
      const f = incident[k];
      const dot =
        faceUnit[f * 3] * faceUnit[t * 3] +
        faceUnit[f * 3 + 1] * faceUnit[t * 3 + 1] +
        faceUnit[f * 3 + 2] * faceUnit[t * 3 + 2];
      if (dot >= cosCrease) {
        nx += faceNormals[f * 3];
        ny += faceNormals[f * 3 + 1];
        nz += faceNormals[f * 3 + 2];
      }
    }
    const length = Math.hypot(nx, ny, nz);
    if (length > 0) {
      nx /= length;
      ny /= length;
      nz /= length;
    } else {
      [nx, ny, nz] = [0, 1, 0];
    }

    const candidates = created.get(v) ?? [];
    let index = candidates.find(
      (o) =>
        outNormals[o * 3] * nx +
          outNormals[o * 3 + 1] * ny +
          outNormals[o * 3 + 2] * nz >
        0.9999,
    );
    if (index === undefined) {
      index = outPositions.length / 3;
      outPositions.push(
        positions[v * 3],
        positions[v * 3 + 1],
        positions[v * 3 + 2],
      );
      outNormals.push(nx, ny, nz);
      candidates.push(index);
      created.set(v, candidates);
    }
    outIndices[i] = index;
  }

  return {
    positions: new Float32Array(outPositions),
    normals: new Float32Array(outNormals),
    indices: outIndices,
  };
}
