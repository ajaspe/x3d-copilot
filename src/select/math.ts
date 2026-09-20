/** Small, dependency-free rotation helpers (axis-angle, quaternion, Euler XYZ). */

export type Vec3 = [number, number, number];
/** X3D SFRotation: axis x y z + angle (radians) */
export type AxisAngle = [number, number, number, number];
/** quaternion x y z w */
export type Quat = [number, number, number, number];

export const DEG = 180 / Math.PI;
export const RAD = Math.PI / 180;

export function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]);
  return l > 1e-12 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 1, 0];
}

export function axisAngleToQuat(r: AxisAngle): Quat {
  const [x, y, z] = normalize([r[0], r[1], r[2]]);
  const h = r[3] / 2;
  const s = Math.sin(h);
  return [x * s, y * s, z * s, Math.cos(h)];
}

export function quatToAxisAngle(q: Quat): AxisAngle {
  let [x, y, z, w] = q;
  const n = Math.hypot(x, y, z, w) || 1;
  x /= n; y /= n; z /= n; w /= n;
  if (w < 0) { x = -x; y = -y; z = -z; w = -w; } // shortest representation
  const s = Math.hypot(x, y, z);
  if (s < 1e-9) return [0, 1, 0, 0];
  const angle = 2 * Math.atan2(s, w);
  return [x / s, y / s, z / s, angle];
}

/** qmul(a, b): rotate by b first, then by a. */
export function qmul(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export function qinv(q: Quat): Quat {
  return [-q[0], -q[1], -q[2], q[3]];
}

export function qrotate(q: Quat, v: Vec3): Vec3 {
  const p: Quat = [v[0], v[1], v[2], 0];
  const r = qmul(qmul(q, p), qinv(q));
  return [r[0], r[1], r[2]];
}

/** Intrinsic XYZ Euler angles (radians) -> quaternion (rotate X, then Y, then Z in parent frame = Rz*Ry*Rx). */
export function eulerToQuat(e: Vec3): Quat {
  const qx = axisAngleToQuat([1, 0, 0, e[0]]);
  const qy = axisAngleToQuat([0, 1, 0, e[1]]);
  const qz = axisAngleToQuat([0, 0, 1, e[2]]);
  return qmul(qz, qmul(qy, qx));
}

/** quaternion -> Euler XYZ (radians), matching eulerToQuat. */
export function quatToEuler(q: Quat): Vec3 {
  const [x, y, z, w] = q;
  // rotation matrix elements
  const m20 = 2 * (x * z - w * y);
  const m00 = 1 - 2 * (y * y + z * z);
  const m10 = 2 * (x * y + w * z);
  const m21 = 2 * (y * z + w * x);
  const m22 = 1 - 2 * (x * x + y * y);
  const sy = Math.max(-1, Math.min(1, -m20));
  const ey = Math.asin(sy);
  if (Math.abs(sy) > 0.99999) {
    // gimbal lock: put all rotation into ex
    const m01 = 2 * (x * y - w * z);
    const m11 = 1 - 2 * (x * x + z * z);
    return [Math.atan2(-m01, m11), ey, 0];
  }
  return [Math.atan2(m21, m22), ey, Math.atan2(m10, m00)];
}

export function axisAngleToEulerDeg(r: AxisAngle): Vec3 {
  const e = quatToEuler(axisAngleToQuat(r));
  return [round(e[0] * DEG, 2), round(e[1] * DEG, 2), round(e[2] * DEG, 2)];
}

export function eulerDegToAxisAngle(e: Vec3): AxisAngle {
  return quatToAxisAngle(eulerToQuat([e[0] * RAD, e[1] * RAD, e[2] * RAD]));
}

export function round(n: number, digits = 4): number {
  const f = 10 ** digits;
  const r = Math.round(n * f) / f;
  return Object.is(r, -0) ? 0 : r;
}

/** Format numbers for X3D attributes: trims trailing zeros, at most `digits` decimals. */
export function fmt(n: number, digits = 4): string {
  return String(round(n, digits));
}

export function fmtVec(v: number[], digits = 4): string {
  return v.map((n) => fmt(n, digits)).join(" ");
}

export function parseNumbers(s: string | undefined, expected: number, fallback: number[]): number[] {
  if (!s) return fallback;
  const nums = s.trim().split(/[\s,]+/).filter(Boolean).map(Number);
  if (nums.length !== expected || nums.some((n) => !Number.isFinite(n))) return fallback;
  return nums;
}

export function isIdentityRotation(r: AxisAngle): boolean {
  return Math.abs(r[3] % (2 * Math.PI)) < 1e-9;
}
