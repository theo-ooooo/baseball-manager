// Procedural three.js stadium. Loaded lazily by stadium-3d.tsx so `three` stays out of the
// main bundle. Everything is generated in code (canvas textures + geometry, no external assets);
// motion is a pure function of the shared replay math (`ballPoint` / `runnerPoint`) and never
// alters results. Only the *look* of the pitch delivery is re-timed (wind-up before release);
// runner and fielder timing follow the shared math exactly.
import * as THREE from 'three';
import {
  ballPoint,
  bases,
  between,
  fieldPoints,
  runnerPoint,
  type Point,
  type replayScene,
} from '@dugout/shared/replay';

export type ReplaySceneData = ReturnType<typeof replayScene>;
export type CameraMode = 'overview' | 'broadcast';

// Shared overhead art is 1536×1024 px with home plate at (768, 867). 1 px ≈ 0.08 m so that the
// 90 ft base path (~337 px) lands close to 27 m.
const SCALE = 0.0814;
const HOME = bases[0];
export const toWorld = (p: Point) =>
  new THREE.Vector3((p.x - HOME.x) * SCALE, 0, (p.y - HOME.y) * SCALE);
const worldPoint = (v: THREE.Vector3) => new THREE.Vector2(v.x, -v.z);
const quad = (a: Point, c: Point, b: Point, t: number): Point => {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
};
const LEFT_POLE = { x: 186, y: 350 },
  RIGHT_POLE = { x: 1350, y: 350 },
  FENCE_CTRL = { x: 768, y: -120 };
/** Point on the outfield fence arc; positive inset moves toward home (px). */
const fencePoint = (t: number, inset = 0): Point => {
  const p = quad(LEFT_POLE, FENCE_CTRL, RIGHT_POLE, t);
  if (!inset) return p;
  const dx = p.x - HOME.x,
    dy = p.y - HOME.y,
    len = Math.hypot(dx, dy);
  return { x: p.x - (dx / len) * inset, y: p.y - (dy / len) * inset };
};
const fenceArc = (inset: number, from: number, to: number, samples: number) =>
  Array.from({ length: samples + 1 }, (_, i) =>
    fencePoint(from + ((to - from) * i) / samples, inset),
  );

// World-space landmarks (metres, home plate at the origin, +z toward the backstop).
const FIELD_CENTER = new THREE.Vector3(0, 0, -26);
const MOUND = toWorld(fieldPoints.P);
const BASE_WORLD = bases.slice(0, 4).map(toWorld);
const DIR1 = BASE_WORLD[1].clone().normalize(),
  DIR3 = BASE_WORLD[3].clone().normalize();
// Unit normals pointing from each foul line into foul territory.
const OUT1 = new THREE.Vector3(-DIR1.z, 0, DIR1.x),
  OUT3 = new THREE.Vector3(DIR3.z, 0, -DIR3.x);
const FENCE_H = 3.4;
const STAND_OFF = 9; // distance from the foul line to the side seating wall
const WALL_H = 1.3;

function foulPole(dir: THREE.Vector3) {
  const N = 600;
  let best = 0,
    bestErr = Infinity;
  for (let i = 0; i <= N; i++) {
    const p = toWorld(fencePoint(i / N));
    if (p.dot(dir) <= 0) continue;
    const err = Math.abs(dir.x * p.z - dir.z * p.x);
    if (err < bestErr) {
      bestErr = err;
      best = i / N;
    }
  }
  return { t: best, point: toWorld(fencePoint(best)) };
}
const POLE_L = foulPole(DIR3),
  POLE_R = foulPole(DIR1);

const PLAYER_SLOTS = 14; // 9 fielders + batter + up to 3 runners (+ spare)
type PartKey =
  | 'head'
  | 'cap'
  | 'brim'
  | 'torso'
  | 'pelvis'
  | 'uarm'
  | 'farm'
  | 'thigh'
  | 'shin'
  | 'shoe'
  | 'glove'
  | 'bat';
const PART_COUNT: Record<PartKey, number> = {
  head: 1,
  cap: 1,
  brim: 1,
  torso: 1,
  pelvis: 1,
  uarm: 2,
  farm: 2,
  thigh: 2,
  shin: 2,
  shoe: 2,
  glove: 1,
  bat: 1,
};
const PART_KEYS = Object.keys(PART_COUNT) as PartKey[];
const UARM = 0.32,
  FARM = 0.3,
  THIGH = 0.46,
  SHIN = 0.44,
  HIP_Y = 0.96;

/** Full body pose. Limb index 0 = right side (model −x), 1 = left side (model +x, glove hand). */
type Actor = {
  slot: number;
  pos: THREE.Vector3;
  yaw: number;
  twist: number; // torso yaw relative to the hips
  lean: number; // torso pitch, positive = forward
  hipDrop: number;
  headPitch: number;
  thigh: [number, number]; // negative = swung forward
  knee: [number, number]; // positive = bent
  shoulder: [number, number]; // negative = raised forward
  roll: [number, number]; // positive = arm out to the side
  elbow: [number, number]; // positive = bent forward
  glove: boolean;
  bat: number; // 0 = hidden, otherwise the bat tilt (radians) from the hand
  batYaw: number;
  visible: boolean;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
const NO_CONTACT = ['walk', 'strikeout', 'tiebreak'];
const PITCH_RELEASE = 0.06; // visual release point inside the shared 0..0.2 pitch segment

function seeded(seed: number) {
  let k = seed;
  return () => (k = (k * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}

// ------------------------------------------------------------------ canvas textures
function canvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
const FONT = "'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', system-ui, sans-serif";

function grassTexture() {
  const texture = canvasTexture(512, 512, (ctx) => {
    const rand = seeded(3);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#4f9040' : '#458338';
      ctx.fillRect(i * 64, 0, 64, 512);
    }
    // Faint perpendicular passes make the mowing pattern read as a checkerboard.
    for (let j = 0; j < 4; j++) {
      ctx.fillStyle = j % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.045)';
      ctx.fillRect(0, j * 128, 512, 128);
    }
    for (let i = 0; i < 9000; i++) {
      const v = rand();
      ctx.fillStyle = v > 0.5 ? 'rgba(255,255,220,0.07)' : 'rgba(0,40,0,0.08)';
      ctx.fillRect(rand() * 512, rand() * 512, 1.5, 2.5 + rand() * 2);
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / 34, 1 / 34);
  return texture;
}

function dirtTexture(base: string) {
  const texture = canvasTexture(256, 256, (ctx) => {
    const rand = seeded(9);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5000; i++) {
      const v = rand();
      ctx.fillStyle = v > 0.5 ? 'rgba(255,230,200,0.10)' : 'rgba(60,30,10,0.12)';
      ctx.fillRect(rand() * 256, rand() * 256, 1 + rand() * 2, 1 + rand() * 2);
    }
    // Drag-mat streaks.
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 24; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * 11 + rand() * 6);
      ctx.lineTo(256, i * 11 + rand() * 6);
      ctx.stroke();
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / 9, 1 / 9);
  return texture;
}

const ADS = [
  { text: 'DUGOUT', bg: '#0b1f3a', fg: '#ffffff' },
  { text: '홈런버거', bg: '#f4d35e', fg: '#3a2a00' },
  { text: 'STRIKE ENERGY', bg: '#c8102e', fg: '#ffffff' },
  { text: '글러브앤코', bg: '#f3f1ea', fg: '#1b2230' },
  { text: 'BASEBALL MANAGER', bg: '#1d6f5f', fg: '#ffffff' },
  { text: '세이프 보험', bg: '#ffffff', fg: '#0b1f3a' },
  { text: 'FULL COUNT', bg: '#2d2d2d', fg: '#ffd166' },
  { text: '다이아몬드 은행', bg: '#0f4c81', fg: '#ffffff' },
];

/** Outfield wall: green padding, ad boards, distance markers and the yellow home-run line. */
function fenceTexture(width: number, lengthMeters: number) {
  return canvasTexture(width, 192, (ctx, w, h) => {
    const px = w / lengthMeters; // pixels per metre along the wall
    ctx.fillStyle = '#1f4e3d';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let m = 0; m < lengthMeters; m += 1.8) ctx.fillRect(Math.round(m * px), 0, 1.5, h);
    // Lower padding seam + darker base.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, h * 0.82, w, h * 0.18);
    // Ad boards: 9 m boards with 5 m green padding between, skipping the centre (batter's eye).
    let m = 7,
      k = 0;
    while (m + 9 < lengthMeters - 7) {
      const centre = Math.abs(m + 4.5 - lengthMeters / 2) < 16;
      if (!centre) {
        const ad = ADS[k++ % ADS.length];
        const x = m * px,
          bw = 9 * px;
        ctx.fillStyle = ad.bg;
        ctx.fillRect(x, h * 0.16, bw, h * 0.6);
        ctx.fillStyle = ad.fg;
        ctx.font = `700 ${Math.round(h * 0.3)}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ad.text, x + bw / 2, h * 0.47, bw * 0.9);
      }
      m += 14;
    }
    // Distance markers (metres) at both poles, the alleys and centre field.
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${Math.round(h * 0.34)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [frac, label] of [
      [0.03, '98'],
      [0.27, '112'],
      [0.5, '122'],
      [0.73, '112'],
      [0.97, '98'],
    ] as [number, string][]) {
      ctx.fillText(label, frac * w, h * 0.5);
    }
    // Home-run line.
    ctx.fillStyle = '#f5d21b';
    ctx.fillRect(0, 0, w, h * 0.08);
  });
}

/** Seating tile: one row of seats/people (v 0..0.69) plus a concrete band (v 0.69..1). */
function crowdTexture(accents: string[]) {
  const texture = canvasTexture(1024, 256, (ctx, w, h) => {
    const rand = seeded(17);
    const seatBase = new THREE.Color('#284a78');
    const shirts = ['#e9e6dd', '#2a2f3a', '#6d7481', '#b8b3a6', '#d8c3a5', '#3f6ea8', ...accents];
    const skins = ['#e8b38a', '#c98a5f', '#8d5a3b', '#f0c9a8', '#6e4429'];
    const band = h * 0.31; // concrete band height (top of the image = v 1)
    ctx.fillStyle = '#9a9ba0';
    ctx.fillRect(0, 0, w, band);
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
      ctx.fillRect(rand() * w, rand() * band, 2, 2);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, band - 3, w, 3);
    // Seats.
    const cell = 32;
    for (let c = 0; c < w / cell; c++) {
      const x = c * cell;
      const seat = seatBase.clone().offsetHSL(0, 0, (rand() - 0.5) * 0.12);
      ctx.fillStyle = '#' + seat.getHexString();
      ctx.fillRect(x + 2, band, cell - 4, h - band);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x + 2, band + 8, cell - 4, 12); // seat back shadow
      if (rand() < 0.86) {
        // Person seen from above/behind: legs at the front (bottom), shirt, then head at the back.
        ctx.fillStyle = rand() > 0.5 ? '#2b2f38' : '#5a5f6b';
        ctx.fillRect(x + 8, h - 44, cell - 16, 34);
        ctx.fillStyle = shirts[Math.floor(rand() * shirts.length)];
        ctx.beginPath();
        ctx.roundRect(x + 5, band + 46, cell - 10, 92, 9);
        ctx.fill();
        ctx.fillStyle = skins[Math.floor(rand() * skins.length)];
        ctx.beginPath();
        ctx.arc(x + cell / 2, band + 40, 10, 0, Math.PI * 2);
        ctx.fill();
        if (rand() < 0.35) {
          ctx.fillStyle = accents[Math.floor(rand() * accents.length)] || '#222';
          ctx.beginPath();
          ctx.arc(x + cell / 2, band + 38, 10.5, Math.PI, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/** Padded wall in front of the seats with rotating sponsor text and team colour blocks. */
function frontWallTexture(attack: string, defend: string) {
  return canvasTexture(2048, 96, (ctx, w, h) => {
    ctx.fillStyle = '#1d3557';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let x = 0; x < w; x += 26) ctx.fillRect(x, 0, 1, h);
    const labels = ['DUGOUT', 'BASEBALL MANAGER', '홈런버거', 'STRIKE ENERGY', '다이아몬드 은행'];
    ctx.font = `700 ${Math.round(h * 0.42)}px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    for (let i = 0; i < 12; i++) {
      const x = (i + 0.5) * (w / 12);
      const team = i === 5 || i === 6;
      ctx.fillStyle = team ? (i === 5 ? defend : attack) : i % 2 ? '#f3f1ea' : '#1d3557';
      ctx.fillRect(x - w / 24 + 6, 10, w / 12 - 12, h - 20);
      ctx.fillStyle = team || i % 2 === 0 ? '#ffffff' : '#1d3557';
      ctx.fillText(team ? 'PLAY BALL' : labels[i % labels.length], x, h / 2, w / 12 - 30);
    }
  });
}

function lampTexture() {
  return canvasTexture(128, 64, (ctx, w, h) => {
    ctx.fillStyle = '#2c3340';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff6d8';
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 7; c++) {
        ctx.beginPath();
        ctx.arc(10 + c * 18, 11 + r * 21, 6, 0, Math.PI * 2);
        ctx.fill();
      }
  });
}

function netTexture() {
  const texture = canvasTexture(64, 64, (ctx) => {
    ctx.clearRect(0, 0, 64, 64);
    ctx.strokeStyle = 'rgba(20,20,30,0.55)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 64; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i + 0.5, 0);
      ctx.lineTo(i + 0.5, 64);
      ctx.moveTo(0, i + 0.5);
      ctx.lineTo(64, i + 0.5);
      ctx.stroke();
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(40, 12);
  return texture;
}

// ------------------------------------------------------------------ geometry helpers
function shapeMesh(points: THREE.Vector2[], material: THREE.Material, height: number) {
  const geometry = new THREE.ShapeGeometry(new THREE.Shape(points), 6);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = height;
  mesh.receiveShadow = true;
  return mesh;
}
/** Closed strip polygon between two open polylines (used for warning tracks). */
const strip = (a: THREE.Vector2[], b: THREE.Vector2[]) => [...a, ...b.slice().reverse()];
const arcPoints = (
  centre: THREE.Vector3,
  radius: number,
  from: number,
  to: number,
  samples: number,
) =>
  Array.from({ length: samples + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / samples;
    return new THREE.Vector3(centre.x + Math.cos(a) * radius, 0, centre.z + Math.sin(a) * radius);
  });
/** Inset a convex polygon (counter-clockwise or clockwise) by `w` metres. */
function insetPolygon(poly: THREE.Vector3[], w: number) {
  const n = poly.length;
  const centroid = poly.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(n);
  const lines = poly.map((a, i) => {
    const b = poly[(i + 1) % n];
    const d = new THREE.Vector3().subVectors(b, a).normalize();
    const normal = new THREE.Vector3(-d.z, 0, d.x);
    if (normal.dot(new THREE.Vector3().subVectors(centroid, a)) < 0) normal.negate();
    return { p: a.clone().addScaledVector(normal, w), d };
  });
  return lines.map((l, i) => {
    const m = lines[(i - 1 + n) % n];
    // Intersect line m with line l (2D, xz).
    const det = m.d.x * l.d.z - m.d.z * l.d.x;
    const t = ((l.p.x - m.p.x) * l.d.z - (l.p.z - m.p.z) * l.d.x) / det;
    return m.p.clone().addScaledVector(m.d, t);
  });
}

/** Vertical ribbon (wall) following a polyline. u runs 0..1 along the path, v bottom..top. */
function wallGeometry(path: THREE.Vector3[], height: number, base = 0) {
  const positions: number[] = [],
    normals: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  for (let i = 0; i < path.length; i++) {
    const p = path[i],
      prev = path[Math.max(0, i - 1)],
      next = path[Math.min(path.length - 1, i + 1)];
    const tangent = new THREE.Vector3().subVectors(next, prev).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
    positions.push(p.x, base, p.z, p.x, base + height, p.z);
    normals.push(normal.x, 0, normal.z, normal.x, 0, normal.z);
    uvs.push(i / (path.length - 1), 0, i / (path.length - 1), 1);
    if (i > 0) {
      const a = (i - 1) * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

type PathSample = { p: THREE.Vector3; n: THREE.Vector3; s: number };
type Tier = { depth: number; rise: number; gap?: number };
/** Samples a curve into points with outward normals (away from `centre`) and arc length. */
function samplePath(points: THREE.Vector3[], centre: THREE.Vector3): PathSample[] {
  let s = 0;
  return points.map((p, i) => {
    const prev = points[Math.max(0, i - 1)],
      next = points[Math.min(points.length - 1, i + 1)];
    const tangent = new THREE.Vector3().subVectors(next, prev).normalize();
    const n = new THREE.Vector3(-tangent.z, 0, tangent.x);
    if (n.dot(new THREE.Vector3().subVectors(p, centre)) < 0) n.negate();
    if (i > 0) s += p.distanceTo(prev);
    return { p: p.clone().setY(0), n, s };
  });
}

/**
 * Stepped seating bowl along a path. Each tier = seat surface + riser, UV-mapped onto the crowd
 * tile so the whole bowl (seats, people, concrete) is one draw call.
 */
function standsGeometry(path: PathSample[], tiers: Tier[], startHeight: number) {
  const positions: number[] = [],
    normals: number[] = [],
    uvs: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const SEAT_TILE = 32 * 0.6; // metres covered by one texture repeat
  let offset = 0,
    height = startHeight;
  const push = (v: THREE.Vector3, n: THREE.Vector3, u: number, vv: number, shade: number) => {
    positions.push(v.x, v.y, v.z);
    normals.push(n.x, n.y, n.z);
    uvs.push(u, vv);
    colors.push(shade, shade, shade);
    return positions.length / 3 - 1;
  };
  const ribbon = (
    inner: (i: number) => THREE.Vector3,
    outer: (i: number) => THREE.Vector3,
    normal: (i: number) => THREE.Vector3,
    vInner: number,
    vOuter: number,
    uShift: number,
    shade: number,
  ) => {
    let prevA = -1,
      prevB = -1;
    for (let i = 0; i < path.length; i++) {
      const u = path[i].s / SEAT_TILE + uShift,
        n = normal(i);
      const a = push(inner(i), n, u, vInner, shade),
        b = push(outer(i), n, u, vOuter, shade);
      if (i > 0) indices.push(prevA, a, prevB, prevB, a, b);
      prevA = a;
      prevB = b;
    }
  };
  const up = new THREE.Vector3(0, 1, 0);
  tiers.forEach((tier, k) => {
    const innerOffset = offset,
      outerOffset = offset + tier.depth,
      h = height,
      shift = (k % 2) * (0.5 / 32);
    ribbon(
      (i) => path[i].p.clone().addScaledVector(path[i].n, innerOffset).setY(h),
      (i) => path[i].p.clone().addScaledVector(path[i].n, outerOffset).setY(h),
      () => up,
      0.0,
      0.68,
      shift,
      1,
    );
    ribbon(
      (i) => path[i].p.clone().addScaledVector(path[i].n, outerOffset).setY(h),
      (i) =>
        path[i].p
          .clone()
          .addScaledVector(path[i].n, outerOffset)
          .setY(h + tier.rise),
      (i) => path[i].n.clone().negate(),
      0.72,
      0.98,
      0,
      0.82,
    );
    offset = outerOffset;
    height = h + tier.rise;
    if (tier.gap) {
      ribbon(
        (i) => path[i].p.clone().addScaledVector(path[i].n, offset).setY(height),
        (i) =>
          path[i].p
            .clone()
            .addScaledVector(path[i].n, offset + tier.gap!)
            .setY(height),
        () => up,
        0.72,
        0.98,
        0,
        0.95,
      );
      offset += tier.gap;
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return { geometry, topHeight: height, topOffset: offset };
}

/** Sloped slab between two polylines (roofs). */
function slabGeometry(inner: THREE.Vector3[], outer: THREE.Vector3[]) {
  const positions: number[] = [],
    index: number[] = [];
  for (let i = 0; i < inner.length; i++) {
    positions.push(inner[i].x, inner[i].y, inner[i].z, outer[i].x, outer[i].y, outer[i].z);
    if (i > 0) {
      const a = (i - 1) * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

export class StadiumController {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1.5, 0.8, 1600);
  private readonly parts: Record<PartKey, THREE.InstancedMesh>;
  private readonly ball: THREE.Mesh;
  private readonly ballShadow: THREE.Mesh;
  private readonly trail: THREE.Line;
  private readonly trailPositions: THREE.BufferAttribute;
  private readonly disposables: { dispose(): void }[] = [];
  private readonly crowdMaterials: THREE.MeshStandardMaterial[] = [];
  private frontWall!: THREE.MeshStandardMaterial;
  private scoreboard!: { texture: THREE.CanvasTexture; canvas: HTMLCanvasElement };
  private boardTrim!: [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial];
  private dugoutTrim!: [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial];
  private bench!: { torso: THREE.InstancedMesh; head: THREE.InstancedMesh };
  private replay: ReplaySceneData | null = null;
  private colors = { attack: '#c8102e', defend: '#0c2340' };
  private mode: CameraMode = 'broadcast';
  private progress = 0;
  private lastProgress = -1;
  private snapCamera = true;
  private frame = 0;
  private lost = false;
  private readonly dummy = new THREE.Object3D();
  private readonly tmpMatrix = new THREE.Matrix4();
  private readonly tmpVec = new THREE.Vector3();
  private readonly tmpVec2 = new THREE.Vector3();
  private readonly pool = Array.from({ length: 96 }, () => new THREE.Matrix4());
  private poolIndex = 0;
  private readonly camPos = new THREE.Vector3();
  private readonly camTarget = new THREE.Vector3();
  private camFov = 30;
  private readonly wantPos = new THREE.Vector3();
  private readonly wantTarget = new THREE.Vector3();
  private readonly actors: Actor[] = Array.from({ length: PLAYER_SLOTS }, (_, slot) => ({
    slot,
    pos: new THREE.Vector3(),
    yaw: 0,
    twist: 0,
    lean: 0,
    hipDrop: 0,
    headPitch: 0,
    thigh: [0, 0],
    knee: [0, 0],
    shoulder: [0, 0],
    roll: [0, 0],
    elbow: [0, 0],
    glove: false,
    bat: 0,
    batYaw: 0,
    visible: false,
  }));

  constructor(
    canvas: HTMLCanvasElement,
    private readonly options: { mobile: boolean; onLost: () => void; onRestored: () => void },
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    canvas.addEventListener('webglcontextlost', this.handleLost);
    canvas.addEventListener('webglcontextrestored', this.handleRestored);

    this.scene.fog = new THREE.Fog('#d3e2f1', 320, 1100);
    this.buildLights();
    this.buildSky();
    this.buildSurroundings();
    this.buildField();
    const mainPath = this.buildMainStands();
    this.buildOutfield();
    this.buildDugouts();
    this.buildScoreboard();
    this.buildTowers();
    this.buildBackstopNet(mainPath);
    this.parts = this.buildPlayers();
    const ballParts = this.buildBall();
    this.ball = ballParts.ball;
    this.ballShadow = ballParts.shadow;
    this.trail = ballParts.trail;
    this.trailPositions = ballParts.trailPositions;
    this.applyTeamColors();
  }

  // ---------------------------------------------------------------- construction
  private track<T extends { dispose(): void }>(item: T) {
    this.disposables.push(item);
    return item;
  }
  private releaseTexture(texture: THREE.Texture) {
    const at = this.disposables.indexOf(texture);
    if (at >= 0) this.disposables.splice(at, 1);
    texture.dispose();
  }
  private material(params: THREE.MeshStandardMaterialParameters) {
    return this.track(new THREE.MeshStandardMaterial(params));
  }
  private add<T extends THREE.Object3D>(mesh: T) {
    if (mesh instanceof THREE.Mesh && !this.disposables.includes(mesh.geometry))
      this.track(mesh.geometry);
    this.scene.add(mesh);
    return mesh;
  }

  private buildLights() {
    this.scene.add(new THREE.HemisphereLight('#cfe1ff', '#6f7d5f', 1.35));
    this.scene.add(new THREE.AmbientLight('#ffffff', 0.32));
    const sun = new THREE.DirectionalLight('#fff4e2', 2.3);
    sun.position.set(-70, 95, 30);
    sun.target.position.copy(FIELD_CENTER);
    sun.castShadow = true;
    const size = this.options.mobile ? 1024 : 2048;
    sun.shadow.mapSize.set(size, size);
    sun.shadow.camera.near = 20;
    sun.shadow.camera.far = 320;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -95;
    sun.shadow.camera.right = sun.shadow.camera.top = 95;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    sun.shadow.radius = 3;
    sun.shadow.intensity = 0.58; // soften: daylight shadows should not read as black
    this.scene.add(sun, sun.target);
  }

  private buildSky() {
    const geometry = this.track(new THREE.SphereGeometry(900, 28, 14));
    const colors: number[] = [];
    const top = new THREE.Color('#3d7fd6'),
      mid = new THREE.Color('#8fbbea'),
      horizon = new THREE.Color('#e6eef6'),
      pos = geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const t = clamp01(pos.getY(i) / 900);
      const c =
        t < 0.25 ? horizon.clone().lerp(mid, t / 0.25) : mid.clone().lerp(top, (t - 0.25) / 0.75);
      colors.push(c.r, c.g, c.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const material = this.track(
      new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }),
    );
    this.add(new THREE.Mesh(geometry, material));
    // Soft cloud puffs.
    const clouds = new THREE.InstancedMesh(
      this.track(new THREE.SphereGeometry(1, 10, 7)),
      this.track(new THREE.MeshBasicMaterial({ color: '#ffffff', fog: true })),
      18,
    );
    const rand = seeded(5);
    for (let i = 0; i < 18; i++) {
      const a = rand() * Math.PI * 2,
        r = 260 + rand() * 260;
      this.dummy.position.set(Math.cos(a) * r, 150 + rand() * 110, Math.sin(a) * r);
      this.dummy.rotation.set(0, rand() * Math.PI, 0);
      this.dummy.scale.set(40 + rand() * 50, 9 + rand() * 7, 22 + rand() * 24);
      this.dummy.updateMatrix();
      clouds.setMatrixAt(i, this.dummy.matrix);
    }
    this.add(clouds);
  }

  private buildSurroundings() {
    const ground = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(2400, 2400)),
      this.material({ color: '#5f8a4c', roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.05, -30);
    ground.receiveShadow = true;
    this.add(ground);
    // Concrete plaza around the stadium footprint.
    const plaza = new THREE.Mesh(
      this.track(new THREE.CircleGeometry(112, 48)),
      this.material({ color: '#a6a39b', roughness: 1 }),
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(0, -0.03, -28);
    plaza.receiveShadow = true;
    this.add(plaza);
    // Tree line and a distant skyline give the outfield a horizon instead of an empty plain.
    const rand = seeded(23);
    const trees = new THREE.InstancedMesh(
      this.track(new THREE.ConeGeometry(2.6, 7, 7)),
      this.material({ color: '#2f6a37', roughness: 1 }),
      110,
    );
    for (let i = 0; i < 110; i++) {
      const a = rand() * Math.PI * 2,
        r = 118 + rand() * 40;
      const s = 0.8 + rand() * 0.7;
      this.dummy.position.set(Math.cos(a) * r, 3.5 * s, -28 + Math.sin(a) * r);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(s, s, s);
      this.dummy.updateMatrix();
      trees.setMatrixAt(i, this.dummy.matrix);
    }
    trees.castShadow = false;
    this.add(trees);
    const skyline = new THREE.InstancedMesh(
      this.track(new THREE.BoxGeometry(1, 1, 1)),
      this.track(new THREE.MeshBasicMaterial({ color: '#8ea3bc', fog: true })),
      56,
    );
    for (let i = 0; i < 56; i++) {
      const a = rand() * Math.PI * 2,
        r = 420 + rand() * 160,
        h = 14 + rand() * 48;
      this.dummy.position.set(Math.cos(a) * r, h / 2, -28 + Math.sin(a) * r);
      this.dummy.rotation.set(0, rand() * Math.PI, 0);
      this.dummy.scale.set(16 + rand() * 24, h, 16 + rand() * 24);
      this.dummy.updateMatrix();
      skyline.setMatrixAt(i, this.dummy.matrix);
    }
    this.add(skyline);
  }

  private buildField() {
    const grassTex = this.track(grassTexture());
    const infieldTex = this.track(grassTex.clone());
    infieldTex.rotation = Math.PI / 4;
    infieldTex.needsUpdate = true;
    const dirtTex = this.track(dirtTexture('#a76a44'));
    const trackTex = this.track(dirtTexture('#b07a52'));
    const grass = this.material({ map: grassTex, roughness: 0.95 });
    const infieldGrass = this.material({ map: infieldTex, roughness: 0.95 });
    const clay = this.material({ map: dirtTex, roughness: 1 });
    const track = this.material({ map: trackTex, roughness: 1 });
    const chalk = this.material({ color: '#f8f4e8', roughness: 0.8 });

    const fenceIn = fenceArc(0, POLE_L.t, POLE_R.t, 72).map((p) => worldPoint(toWorld(p)));
    // Keep the mown playing surface inside the park, including foul territory.
    const grassBoundary = [
      ...fenceIn,
      worldPoint(POLE_R.point.clone().addScaledVector(OUT1, STAND_OFF)),
      new THREE.Vector2(8, -STAND_OFF - 4),
      new THREE.Vector2(-8, -STAND_OFF - 4),
      worldPoint(POLE_L.point.clone().addScaledVector(OUT3, STAND_OFF)),
    ];
    this.add(shapeMesh(grassBoundary, grass, 0));

    // Warning track in front of the outfield wall.
    const trackIn = fenceArc(42, POLE_L.t, POLE_R.t, 72).map((p) => worldPoint(toWorld(p)));
    this.add(shapeMesh(strip(fenceIn, trackIn), track, 0.012));

    // Infield skin: foul-line edges + the outfield arc centred on the mound.
    const arcR = MOUND.distanceTo(BASE_WORLD[2]) * 1.42;
    const hit = (dir: THREE.Vector3) => {
      const dp = dir.dot(MOUND);
      return dp + Math.sqrt(dp * dp - MOUND.lengthSq() + arcR * arcR);
    };
    const hit3 = DIR3.clone().multiplyScalar(hit(DIR3)),
      hit1 = DIR1.clone().multiplyScalar(hit(DIR1));
    const a3 = Math.atan2(hit3.z - MOUND.z, hit3.x - MOUND.x),
      a1 = Math.atan2(hit1.z - MOUND.z, hit1.x - MOUND.x);
    const skin = [
      DIR3.clone().multiplyScalar(3.2),
      hit3,
      ...arcPoints(MOUND, arcR, a3, a1 < a3 ? a1 + Math.PI * 2 : a1, 48),
      hit1,
      DIR1.clone().multiplyScalar(3.2),
    ].map(worldPoint);
    this.add(shapeMesh(skin, clay, 0.024));
    // Grass inside the base paths, then dirt cut-outs around the bases and home plate.
    const diamond = insetPolygon(BASE_WORLD, 1.35).map(worldPoint);
    this.add(shapeMesh(diamond, infieldGrass, 0.036));
    const cutout = this.track(new THREE.CircleGeometry(2.6, 28));
    for (let i = 1; i <= 3; i++) {
      const b = BASE_WORLD[i];
      const c = new THREE.Mesh(cutout, clay);
      c.rotation.x = -Math.PI / 2;
      c.position.set(b.x, 0.048, b.z);
      c.receiveShadow = true;
      this.add(c);
    }
    const homeCircle = new THREE.Mesh(this.track(new THREE.CircleGeometry(4.0, 36)), clay);
    homeCircle.rotation.x = -Math.PI / 2;
    homeCircle.position.set(0, 0.048, 0);
    homeCircle.receiveShadow = true;
    this.add(homeCircle);
    // Mound with rubber.
    const moundBase = new THREE.Mesh(this.track(new THREE.CircleGeometry(3.6, 36)), clay);
    moundBase.rotation.x = -Math.PI / 2;
    moundBase.position.set(MOUND.x, 0.048, MOUND.z);
    this.add(moundBase);
    const mound = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(1.7, 3.4, 0.3, 36)),
      this.material({ map: dirtTex, color: '#b9805a', roughness: 1 }),
    );
    mound.position.set(MOUND.x, 0.15, MOUND.z);
    mound.castShadow = mound.receiveShadow = true;
    this.add(mound);
    const rubber = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.6, 0.05, 0.16)), chalk);
    rubber.position.set(MOUND.x, 0.325, MOUND.z);
    this.add(rubber);
    // Home plate.
    const plateShape = new THREE.Shape([
      new THREE.Vector2(-0.22, 0.22),
      new THREE.Vector2(0.22, 0.22),
      new THREE.Vector2(0.22, 0),
      new THREE.Vector2(0, -0.22),
      new THREE.Vector2(-0.22, 0),
    ]);
    const plate = new THREE.Mesh(this.track(new THREE.ShapeGeometry(plateShape)), chalk);
    plate.rotation.x = -Math.PI / 2;
    plate.position.set(0, 0.062, 0);
    this.add(plate);
    // Bases (one instanced mesh, 3 instances).
    const baseMesh = new THREE.InstancedMesh(
      this.track(new THREE.BoxGeometry(0.45, 0.12, 0.45)),
      chalk,
      3,
    );
    for (let i = 1; i <= 3; i++) {
      const b = BASE_WORLD[i];
      this.dummy.position.set(b.x, 0.1, b.z);
      this.dummy.rotation.set(0, Math.PI / 4, 0);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      baseMesh.setMatrixAt(i - 1, this.dummy.matrix);
    }
    baseMesh.castShadow = true;
    this.add(baseMesh);
    // On-deck circles beside each dugout.
    const onDeck = this.track(new THREE.CircleGeometry(1.4, 24));
    for (const [dir, out] of [
      [DIR1, OUT1],
      [DIR3, OUT3],
    ] as const) {
      const c = new THREE.Mesh(onDeck, clay);
      c.rotation.x = -Math.PI / 2;
      const p = dir.clone().multiplyScalar(9).addScaledVector(out, 5.4);
      c.position.set(p.x, 0.024, p.z);
      this.add(c);
    }
    this.buildChalk(chalk);
  }

  /** All chalk lines in one instanced mesh: foul lines, boxes, coach boxes, running lane. */
  private buildChalk(chalk: THREE.Material) {
    const segments: { a: THREE.Vector3; b: THREE.Vector3; w: number }[] = [];
    const seg = (a: THREE.Vector3, b: THREE.Vector3, w = 0.09) => segments.push({ a, b, w });
    const rect = (
      centre: THREE.Vector3,
      dir: THREE.Vector3,
      len: number,
      wid: number,
      w = 0.09,
    ) => {
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      const c = (u: number, v: number) =>
        centre
          .clone()
          .addScaledVector(dir, u * len * 0.5)
          .addScaledVector(side, v * wid * 0.5);
      seg(c(-1, -1), c(1, -1), w);
      seg(c(1, -1), c(1, 1), w);
      seg(c(1, 1), c(-1, 1), w);
      seg(c(-1, 1), c(-1, -1), w);
    };
    const zAxis = new THREE.Vector3(0, 0, 1);
    seg(new THREE.Vector3(), POLE_L.point, 0.13);
    seg(new THREE.Vector3(), POLE_R.point, 0.13);
    rect(new THREE.Vector3(-0.95, 0, 0.05), zAxis, 1.8, 1.2);
    rect(new THREE.Vector3(0.95, 0, 0.05), zAxis, 1.8, 1.2);
    rect(new THREE.Vector3(0, 0, 1.95), zAxis, 1.0, 1.1);
    for (const [dir, out] of [
      [DIR1, OUT1],
      [DIR3, OUT3],
    ] as const) {
      rect(dir.clone().multiplyScalar(27.4).addScaledVector(out, 5.2), dir, 6, 3);
    }
    // Running lane on the first-base side.
    seg(
      DIR1.clone().multiplyScalar(13.7).addScaledVector(OUT1, 0.9),
      DIR1.clone().multiplyScalar(27.4).addScaledVector(OUT1, 0.9),
    );
    const mesh = new THREE.InstancedMesh(
      this.track(new THREE.BoxGeometry(1, 0.02, 1)),
      chalk,
      segments.length,
    );
    segments.forEach((s, i) => {
      const len = s.a.distanceTo(s.b);
      this.dummy.position.lerpVectors(s.a, s.b, 0.5).setY(0.058);
      this.dummy.rotation.set(0, Math.atan2(s.b.x - s.a.x, s.b.z - s.a.z), 0);
      this.dummy.scale.set(s.w, 1, len);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(i, this.dummy.matrix);
    });
    this.add(mesh);
  }

  /** Main bowl behind home plate and down both foul lines. Returns its front-wall path. */
  private buildMainStands() {
    const control: THREE.Vector3[] = [];
    const sL = POLE_L.point.dot(DIR3) + 1,
      sR = POLE_R.point.dot(DIR1) + 1;
    for (const f of [1, 0.85, 0.7, 0.55, 0.4, 0.27, 0.16])
      control.push(
        DIR3.clone()
          .multiplyScalar(sL * f)
          .addScaledVector(OUT3, STAND_OFF),
      );
    control.push(new THREE.Vector3(-4.5, 0, STAND_OFF + 2.6));
    control.push(new THREE.Vector3(0, 0, STAND_OFF + 3.4));
    control.push(new THREE.Vector3(4.5, 0, STAND_OFF + 2.6));
    for (const f of [0.16, 0.27, 0.4, 0.55, 0.7, 0.85, 1])
      control.push(
        DIR1.clone()
          .multiplyScalar(sR * f)
          .addScaledVector(OUT1, STAND_OFF),
      );
    const curve = new THREE.CatmullRomCurve3(control, false, 'centripetal', 0.5);
    const path = samplePath(curve.getSpacedPoints(this.options.mobile ? 110 : 150), FIELD_CENTER);
    const tiers: Tier[] = [
      ...Array.from({ length: 11 }, () => ({ depth: 1.0, rise: 0.55 })),
      { depth: 1.0, rise: 0.55, gap: 2.4 },
      ...Array.from({ length: 13 }, () => ({ depth: 0.95, rise: 0.72 })),
    ];
    const built = this.buildBowl(path, tiers, WALL_H, true);
    // Warning track along the side walls and behind home plate.
    const trackOuter = path.map((s) => worldPoint(s.p));
    const trackInner = path.map((s) => worldPoint(s.p.clone().addScaledVector(s.n, -3.2)));
    this.add(
      shapeMesh(
        strip(trackOuter, trackInner),
        this.material({ map: this.track(dirtTexture('#b07a52')), roughness: 1 }),
        0.012,
      ),
    );
    // Padded front wall with sponsor boards.
    this.frontWall = this.material({ roughness: 0.85, side: THREE.DoubleSide });
    const wall = new THREE.Mesh(
      this.track(
        wallGeometry(
          path.map((s) => s.p),
          WALL_H,
        ),
      ),
      this.frontWall,
    );
    wall.castShadow = wall.receiveShadow = true;
    this.add(wall);
    // Short corner walls linking the foul poles to the side stands.
    const corner = this.material({ color: '#1f4e3d', roughness: 0.9, side: THREE.DoubleSide });
    for (const [pole, out] of [
      [POLE_L.point, OUT3],
      [POLE_R.point, OUT1],
    ] as const) {
      const c = new THREE.Mesh(
        this.track(
          wallGeometry([pole, pole.clone().addScaledVector(out, STAND_OFF + 0.5)], FENCE_H),
        ),
        corner,
      );
      c.castShadow = true;
      this.add(c);
    }
    // Back wall + cantilever roof over the upper deck.
    const back = path.map((s) => s.p.clone().addScaledVector(s.n, built.topOffset));
    const backWall = new THREE.Mesh(
      this.track(wallGeometry(back, 7, built.topHeight)),
      this.material({ color: '#556173', roughness: 0.9, side: THREE.DoubleSide }),
    );
    backWall.castShadow = true;
    this.add(backWall);
    const outer = new THREE.Mesh(
      this.track(wallGeometry(back, built.topHeight + 7, 0)),
      this.material({ color: '#7d8797', roughness: 0.9, side: THREE.BackSide }),
    );
    this.add(outer);
    const roofInner = path.map((s) =>
      s.p
        .clone()
        .addScaledVector(s.n, built.topOffset - 11)
        .setY(built.topHeight + 6.4),
    );
    const roofOuter = back.map((p) => p.clone().setY(built.topHeight + 7.2));
    const roof = new THREE.Mesh(
      this.track(slabGeometry(roofInner, roofOuter)),
      this.material({ color: '#e3e6ea', roughness: 0.6, side: THREE.DoubleSide }),
    );
    roof.castShadow = true;
    this.add(roof);
    return path;
  }

  private buildBowl(path: PathSample[], tiers: Tier[], startHeight: number, cast: boolean) {
    const built = standsGeometry(path, tiers, startHeight);
    this.track(built.geometry);
    const material = this.material({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide });
    this.crowdMaterials.push(material);
    const mesh = new THREE.Mesh(built.geometry, material);
    mesh.receiveShadow = true;
    mesh.castShadow = cast;
    this.add(mesh);
    return built;
  }

  /** Outfield: padded wall with ads, yellow line, foul poles, bleachers and the batter's eye. */
  private buildOutfield() {
    const samples = this.options.mobile ? 64 : 96;
    const path = fenceArc(0, POLE_L.t, POLE_R.t, samples).map(toWorld);
    let length = 0;
    for (let i = 1; i < path.length; i++) length += path[i].distanceTo(path[i - 1]);
    const fenceTex = this.track(fenceTexture(this.options.mobile ? 2048 : 4096, length));
    const wall = new THREE.Mesh(
      this.track(wallGeometry(path, FENCE_H)),
      this.material({ map: fenceTex, roughness: 0.9, side: THREE.DoubleSide }),
    );
    wall.castShadow = wall.receiveShadow = true;
    this.add(wall);
    const rail = new THREE.Mesh(
      this.track(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(path.map((p) => p.clone().setY(FENCE_H))),
          samples,
          0.08,
          6,
          false,
        ),
      ),
      this.material({ color: '#f2c600', roughness: 0.6 }),
    );
    this.add(rail);
    const poles = new THREE.InstancedMesh(
      this.track(new THREE.CylinderGeometry(0.14, 0.14, 16, 8)),
      this.material({ color: '#f5d21b', roughness: 0.5 }),
      2,
    );
    [POLE_L.point, POLE_R.point].forEach((p, i) => {
      this.dummy.position.set(p.x, 8, p.z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      poles.setMatrixAt(i, this.dummy.matrix);
    });
    poles.castShadow = true;
    this.add(poles);
    // Bleachers rise from behind the wall.
    const bleacherPath = samplePath(
      fenceArc(-24, POLE_L.t, POLE_R.t, samples).map(toWorld),
      FIELD_CENTER,
    );
    const tiers: Tier[] = Array.from({ length: 12 }, () => ({ depth: 1.0, rise: 0.6 }));
    const built = this.buildBowl(bleacherPath, tiers, FENCE_H + 0.2, false);
    const back = bleacherPath.map((s) => s.p.clone().addScaledVector(s.n, built.topOffset));
    this.add(
      new THREE.Mesh(
        this.track(wallGeometry(back, built.topHeight + 1.2, 0)),
        this.material({ color: '#6b7585', roughness: 0.9, side: THREE.DoubleSide }),
      ),
    );
    // Concrete face between fence top and the first bleacher row.
    this.add(
      new THREE.Mesh(
        this.track(
          wallGeometry(
            bleacherPath.map((s) => s.p),
            FENCE_H + 0.2,
            0,
          ),
        ),
        this.material({ color: '#8b93a1', roughness: 1, side: THREE.DoubleSide }),
      ),
    );
    // Batter's eye: dark green screen over the centre-field seats.
    const cf = toWorld(fencePoint(0.5, -30));
    const eye = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(24, 8.5, 0.6)),
      this.material({ color: '#173b2c', roughness: 1 }),
    );
    eye.position.set(cf.x, FENCE_H + 4.4, cf.z);
    eye.castShadow = true;
    this.add(eye);
  }

  private buildDugouts() {
    const dark = this.material({ color: '#1a1d24', roughness: 1, side: THREE.BackSide });
    const concrete = this.material({ color: '#c9ccd1', roughness: 0.8 });
    const benchMat = this.material({ color: '#4a5566', roughness: 0.7 });
    const trimA = this.material({ roughness: 0.6 }),
      trimB = this.material({ roughness: 0.6 });
    this.dugoutTrim = [trimA, trimB];
    const torsoGeo = this.track(new THREE.CapsuleGeometry(0.2, 0.3, 3, 8));
    const headGeo = this.track(new THREE.SphereGeometry(0.14, 10, 8));
    const benchTorso = new THREE.InstancedMesh(torsoGeo, this.material({ roughness: 0.8 }), 16);
    const benchHead = new THREE.InstancedMesh(headGeo, this.material({ roughness: 0.8 }), 16);
    const configs = [
      { dir: DIR1, out: OUT1, trim: trimA },
      { dir: DIR3, out: OUT3, trim: trimB },
    ];
    configs.forEach(({ dir, out, trim }, side) => {
      const centre = dir
        .clone()
        .multiplyScalar(17)
        .addScaledVector(out, STAND_OFF + 1.0);
      const yaw = Math.atan2(dir.x, dir.z);
      const room = new THREE.Mesh(this.track(new THREE.BoxGeometry(13, 2.6, 2.0)), dark);
      room.position.set(centre.x, 1.3, centre.z);
      room.rotation.y = yaw;
      this.add(room);
      const roof = new THREE.Mesh(this.track(new THREE.BoxGeometry(13.6, 0.25, 2.6)), concrete);
      roof.position.set(centre.x, 2.72, centre.z);
      roof.rotation.y = yaw;
      roof.castShadow = true;
      this.add(roof);
      const fascia = new THREE.Mesh(this.track(new THREE.BoxGeometry(13.6, 0.5, 0.12)), trim);
      const front = centre.clone().addScaledVector(out, -1.3);
      fascia.position.set(front.x, 2.55, front.z);
      fascia.rotation.y = yaw;
      this.add(fascia);
      const rail = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(13, 0.07, 0.07)),
        this.material({ color: '#dfe3e8', roughness: 0.4, metalness: 0.5 }),
      );
      rail.position.set(front.x, 1.0, front.z);
      rail.rotation.y = yaw;
      this.add(rail);
      const bench = new THREE.Mesh(this.track(new THREE.BoxGeometry(12, 0.08, 0.5)), benchMat);
      const backLine = centre.clone().addScaledVector(out, 0.6);
      bench.position.set(backLine.x, 0.5, backLine.z);
      bench.rotation.y = yaw;
      this.add(bench);
      for (let i = 0; i < 8; i++) {
        const p = backLine.clone().addScaledVector(dir, -5.2 + i * 1.5);
        this.dummy.position.set(p.x, 0.85, p.z);
        this.dummy.rotation.set(0, yaw, 0);
        this.dummy.scale.setScalar(1);
        this.dummy.updateMatrix();
        benchTorso.setMatrixAt(side * 8 + i, this.dummy.matrix);
        this.dummy.position.y = 1.3;
        this.dummy.updateMatrix();
        benchHead.setMatrixAt(side * 8 + i, this.dummy.matrix);
      }
    });
    this.add(benchTorso);
    this.add(benchHead);
    this.bench = { torso: benchTorso, head: benchHead };
  }

  private buildScoreboard() {
    const cf = toWorld(fencePoint(0.5, -34));
    const width = 30,
      height = 11.5,
      base = FENCE_H + 8.8;
    const frame = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(width + 1.2, height + 1.2, 1.0)),
      this.material({ color: '#1b2230', roughness: 0.7 }),
    );
    frame.position.set(cf.x, base + height / 2, cf.z - 0.6);
    frame.castShadow = true;
    this.add(frame);
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 384;
    const texture = this.track(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    this.scoreboard = { texture, canvas };
    const screen = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(width, height)),
      this.material({
        color: '#000000',
        emissive: '#ffffff',
        emissiveMap: texture,
        emissiveIntensity: 1.35,
        roughness: 0.4,
      }),
    );
    screen.position.set(cf.x, base + height / 2, cf.z - 0.08);
    this.add(screen);
    const trimGeo = this.track(new THREE.BoxGeometry(width / 2 - 0.4, 0.9, 0.3));
    const left = this.material({ emissiveIntensity: 0.5 }),
      right = this.material({ emissiveIntensity: 0.5 });
    const a = new THREE.Mesh(trimGeo, left),
      b = new THREE.Mesh(trimGeo, right);
    a.position.set(cf.x - width / 4, base - 0.9, cf.z - 0.2);
    b.position.set(cf.x + width / 4, base - 0.9, cf.z - 0.2);
    this.add(a);
    this.add(b);
    this.boardTrim = [left, right];
    const legs = new THREE.InstancedMesh(
      this.track(new THREE.BoxGeometry(0.8, base, 0.8)),
      this.material({ color: '#2b313c', roughness: 0.9 }),
      2,
    );
    [-1, 1].forEach((s, i) => {
      this.dummy.position.set(cf.x + s * (width / 2 - 2), base / 2, cf.z - 0.6);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      legs.setMatrixAt(i, this.dummy.matrix);
    });
    this.add(legs);
    this.drawScoreboard();
  }

  private drawScoreboard() {
    const { canvas, texture } = this.scoreboard;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width,
      h = canvas.height;
    const replay = this.replay,
      event = replay?.event,
      play = replay?.play;
    ctx.fillStyle = '#05080f';
    ctx.fillRect(0, 0, w, h);
    // LED grid.
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for (let x = 0; x < w; x += 8) ctx.fillRect(x, 0, 1, h);
    for (let y = 0; y < h; y += 8) ctx.fillRect(0, y, w, 1);
    ctx.textBaseline = 'middle';
    // Header bar.
    ctx.fillStyle = '#101a2e';
    ctx.fillRect(0, 0, w, 78);
    ctx.fillStyle = '#ffd166';
    ctx.font = `800 40px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(event ? `${event.inning}회 ${event.half ? '말' : '초'}` : 'PLAY BALL', 32, 39);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 34px ${FONT}`;
    const outs = play ? play.before.outs : 0;
    ctx.fillText('OUT', w - 150, 39);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < outs ? '#ff5a3c' : '#2c3548';
      ctx.beginPath();
      ctx.arc(w - 112 + i * 40, 39, 13, 0, Math.PI * 2);
      ctx.fill();
    }
    // Score.
    const score = play?.after.score || event?.score || [0, 0];
    const boxW = 300;
    const drawScore = (x: number, label: string, value: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, 100, boxW, 16);
      ctx.fillStyle = '#e8ecf3';
      ctx.font = `700 36px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText(label, x, 150);
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 96px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(String(value), x + boxW, 210);
    };
    const awayColor = event?.half === 1 ? this.colors.defend : this.colors.attack;
    const homeColor = event?.half === 1 ? this.colors.attack : this.colors.defend;
    drawScore(40, 'AWAY', score[0] ?? 0, awayColor);
    drawScore(w - 40 - boxW, 'HOME', score[1] ?? 0, homeColor);
    // Centre: batter / pitcher.
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8fa3c4';
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText('BATTER', w / 2, 118);
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 52px ${FONT}`;
    ctx.fillText(replay?.batter || '—', w / 2, 162, 340);
    ctx.fillStyle = '#8fa3c4';
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText('PITCHER', w / 2, 212);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 40px ${FONT}`;
    ctx.fillText(replay?.pitcher || '—', w / 2, 250, 340);
    // Ticker with the play text.
    ctx.fillStyle = '#0d1524';
    ctx.fillRect(0, h - 78, w, 78);
    ctx.fillStyle = '#ffd166';
    ctx.font = `700 38px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(event?.text || 'DUGOUT BASEBALL MANAGER', w / 2, h - 39, w - 80);
    texture.needsUpdate = true;
  }

  private buildTowers() {
    const steel = this.material({ color: '#9aa3ad', roughness: 0.55, metalness: 0.5 });
    const lamp = this.material({
      color: '#ffffff',
      emissive: '#ffffff',
      emissiveMap: this.track(lampTexture()),
      map: this.track(lampTexture()),
      emissiveIntensity: 0.8,
    });
    const spots: Point[] = [
      { x: 100, y: 470 },
      { x: 1436, y: 470 },
      { x: 330, y: 60 },
      { x: 1206, y: 60 },
      { x: 340, y: 1010 },
      { x: 1196, y: 1010 },
    ];
    const poles = new THREE.InstancedMesh(
      this.track(new THREE.CylinderGeometry(0.35, 0.6, 38, 8)),
      steel,
      spots.length,
    );
    const banks = new THREE.InstancedMesh(
      this.track(new THREE.BoxGeometry(7, 3, 0.7)),
      lamp,
      spots.length,
    );
    spots.forEach((s, i) => {
      const p = toWorld(s);
      this.dummy.position.set(p.x, 19, p.z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      poles.setMatrixAt(i, this.dummy.matrix);
      this.dummy.position.set(p.x, 39, p.z);
      this.dummy.lookAt(FIELD_CENTER.x, 0, FIELD_CENTER.z);
      this.dummy.updateMatrix();
      banks.setMatrixAt(i, this.dummy.matrix);
    });
    poles.castShadow = true;
    this.add(poles);
    this.add(banks);
  }

  private buildBackstopNet(path: PathSample[]) {
    // Net panels from the wall top up behind home plate, leaning toward the field.
    const centre = path.length >> 1;
    const span = Math.round(path.length * 0.12);
    const bottom = path
      .slice(centre - span, centre + span + 1)
      .map((s) => s.p.clone().setY(WALL_H));
    const positions: number[] = [],
      uvs: number[] = [],
      index: number[] = [];
    bottom.forEach((p, i) => {
      const top = p
        .clone()
        .addScaledVector(path[centre - span + i].n, -1.6)
        .setY(WALL_H + 7.5);
      positions.push(p.x, p.y, p.z, top.x, top.y, top.z);
      uvs.push(i / (bottom.length - 1), 0, i / (bottom.length - 1), 1);
      if (i > 0) {
        const a = (i - 1) * 2;
        index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    });
    const geometry = this.track(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    const net = new THREE.Mesh(
      geometry,
      this.track(
        new THREE.MeshBasicMaterial({
          map: this.track(netTexture()),
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      ),
    );
    this.add(net);
  }

  private buildPlayers(): Record<PartKey, THREE.InstancedMesh> {
    const make = (geometry: THREE.BufferGeometry, key: PartKey, roughness = 0.75) => {
      const mesh = new THREE.InstancedMesh(
        this.track(geometry),
        this.material({ roughness }),
        PLAYER_SLOTS * PART_COUNT[key],
      );
      mesh.castShadow = true;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      this.add(mesh);
      return mesh;
    };
    return {
      head: make(new THREE.SphereGeometry(0.165, 16, 12), 'head', 0.6),
      cap: make(new THREE.SphereGeometry(0.185, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), 'cap'),
      brim: make(new THREE.BoxGeometry(0.22, 0.03, 0.16), 'brim'),
      torso: make(new THREE.CapsuleGeometry(0.22, 0.34, 6, 12), 'torso'),
      pelvis: make(new THREE.BoxGeometry(0.38, 0.22, 0.26), 'pelvis'),
      uarm: make(new THREE.CapsuleGeometry(0.07, UARM - 0.12, 4, 8), 'uarm'),
      farm: make(new THREE.CapsuleGeometry(0.06, FARM - 0.1, 4, 8), 'farm', 0.6),
      thigh: make(new THREE.CapsuleGeometry(0.1, THIGH - 0.18, 4, 8), 'thigh'),
      shin: make(new THREE.CapsuleGeometry(0.08, SHIN - 0.14, 4, 8), 'shin'),
      shoe: make(new THREE.BoxGeometry(0.15, 0.09, 0.32), 'shoe'),
      glove: make(new THREE.SphereGeometry(0.15, 12, 8), 'glove', 0.9),
      bat: make(new THREE.CylinderGeometry(0.036, 0.016, 0.86, 10), 'bat', 0.45),
    };
  }

  private buildBall() {
    const ball = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(0.2, 14, 10)),
      this.material({
        color: '#ffffff',
        emissive: '#ffffff',
        emissiveIntensity: 0.25,
        roughness: 0.4,
      }),
    );
    ball.castShadow = true;
    ball.visible = false;
    this.add(ball);
    const shadow = new THREE.Mesh(
      this.track(new THREE.CircleGeometry(0.42, 16)),
      this.track(
        new THREE.MeshBasicMaterial({
          color: '#000000',
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
        }),
      ),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.visible = false;
    this.add(shadow);
    const TRAIL = 14;
    const trailPositions = new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3);
    trailPositions.setUsage(THREE.DynamicDrawUsage);
    const colors = new Float32Array(TRAIL * 3);
    for (let i = 0; i < TRAIL; i++) {
      const f = 1 - i / TRAIL;
      colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = 0.35 + f * 0.65;
    }
    const geometry = this.track(new THREE.BufferGeometry());
    geometry.setAttribute('position', trailPositions);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const trail = new THREE.Line(
      geometry,
      this.track(
        new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 }),
      ),
    );
    trail.frustumCulled = false;
    trail.visible = false;
    this.add(trail);
    return { ball, shadow, trail, trailPositions };
  }

  // ---------------------------------------------------------------- team colours
  private applyTeamColors() {
    const attack = new THREE.Color(this.colors.attack),
      defend = new THREE.Color(this.colors.defend);
    // Stands: seat/crowd tile picks up both team colours.
    const crowd = this.track(crowdTexture([this.colors.attack, this.colors.defend]));
    for (const previous of new Set(this.crowdMaterials.map((m) => m.map)))
      if (previous) this.releaseTexture(previous);
    for (const m of this.crowdMaterials) {
      m.map = crowd;
      m.needsUpdate = true;
    }
    if (this.frontWall.map) this.releaseTexture(this.frontWall.map);
    this.frontWall.map = this.track(frontWallTexture(this.colors.attack, this.colors.defend));
    this.frontWall.map.wrapS = THREE.RepeatWrapping;
    this.frontWall.map.repeat.x = -1;
    this.frontWall.map.offset.x = 1;
    this.frontWall.needsUpdate = true;
    const home = this.replay?.event?.half === 1 ? attack : defend,
      away = this.replay?.event?.half === 1 ? defend : attack;
    this.boardTrim[0].color.copy(away);
    this.boardTrim[0].emissive.copy(away);
    this.boardTrim[1].color.copy(home);
    this.boardTrim[1].emissive.copy(home);
    // Home club always uses the first-base dugout.
    this.dugoutTrim[0].color.copy(home);
    this.dugoutTrim[1].color.copy(away);
    const skinTones = ['#e8b38a', '#c98a5f', '#8d5a3b', '#f0c9a8', '#6e4429'];
    for (let i = 0; i < 16; i++) {
      const team = i < 8 ? home : away;
      this.bench.torso.setColorAt(
        i,
        i % 3 === 0 ? team.clone().lerp(new THREE.Color('#333'), 0.5) : team,
      );
      this.bench.head.setColorAt(i, new THREE.Color(skinTones[(i * 5) % skinTones.length]));
    }
    this.bench.torso.instanceColor!.needsUpdate = true;
    this.bench.head.instanceColor!.needsUpdate = true;
    // Players.
    for (let slot = 0; slot < PLAYER_SLOTS; slot++) {
      const attacking = slot >= 9;
      const team = attacking ? attack : defend;
      const homeKit = attacking === (this.replay?.event?.half === 1);
      const jersey = homeKit ? new THREE.Color('#f3f1ea') : team;
      const pants = new THREE.Color(homeKit ? '#f3f1ea' : '#d5d7d9');
      const skin = new THREE.Color(skinTones[(slot * 7) % skinTones.length]);
      const cap = team.clone().multiplyScalar(attacking ? 0.55 : 0.8); // batting helmets darker
      const set = (key: PartKey, color: THREE.Color) => {
        for (let k = 0; k < PART_COUNT[key]; k++)
          this.parts[key].setColorAt(slot * PART_COUNT[key] + k, color);
      };
      set('head', skin);
      set('cap', cap);
      set('brim', cap);
      set('torso', jersey);
      set('pelvis', pants);
      set('uarm', team);
      set('farm', skin);
      set('thigh', pants);
      set('shin', pants);
      set('shoe', new THREE.Color('#1c1f26'));
      set('glove', new THREE.Color('#8a5a2b'));
      set('bat', new THREE.Color('#c9a071'));
    }
    for (const mesh of Object.values(this.parts))
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  setReplay(replay: ReplaySceneData, attackColor: string, defendColor: string) {
    const next = {
      attack: attackColor || this.colors.attack,
      defend: defendColor || this.colors.defend,
    };
    const recolor =
      next.attack !== this.colors.attack ||
      next.defend !== this.colors.defend ||
      replay.event?.half !== this.replay?.event?.half;
    this.replay = replay;
    this.colors = next;
    if (recolor) this.applyTeamColors();
    this.drawScoreboard();
    this.snapCamera = true;
  }

  setCamera(mode: CameraMode) {
    if (mode !== this.mode) this.snapCamera = true;
    this.mode = mode;
  }

  setProgress(progress: number) {
    this.progress = clamp01(progress);
  }

  resize(width: number, height: number) {
    if (width <= 0 || height <= 0) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.snapCamera = true;
  }

  /** Coalesces renders into a single animation frame. */
  requestRender() {
    if (this.frame || this.lost) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.render();
    });
  }

  render() {
    if (this.lost) return;
    this.updateActors();
    this.updateBall();
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
    this.lastProgress = this.progress;
  }

  dispose() {
    if (this.frame) cancelAnimationFrame(this.frame);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('webglcontextlost', this.handleLost);
    canvas.removeEventListener('webglcontextrestored', this.handleRestored);
    for (const item of this.disposables) item.dispose();
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  private handleLost = (event: Event) => {
    event.preventDefault();
    this.lost = true;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.options.onLost();
  };
  private handleRestored = () => {
    this.lost = false;
    this.snapCamera = true;
    this.options.onRestored();
    this.requestRender();
  };

  // ---------------------------------------------------------------- poses
  private static neutral(actor: Actor) {
    actor.twist = 0;
    actor.lean = 0.05;
    actor.hipDrop = 0;
    actor.headPitch = 0;
    actor.thigh = [0, 0];
    actor.knee = [0, 0];
    actor.shoulder = [0.1, 0.1];
    actor.roll = [0.12, 0.12];
    actor.elbow = [0.25, 0.25];
    actor.glove = false;
    actor.bat = 0;
    actor.batYaw = 0;
  }
  /** Athletic ready stance; `c` 0..1 = how deep. */
  private static ready(actor: Actor, c: number) {
    actor.lean = 0.35 * c + 0.05;
    actor.hipDrop = 0.3 * c;
    actor.thigh = [-0.9 * c, -0.9 * c];
    actor.knee = [1.5 * c, 1.5 * c];
    actor.roll = [0.35, 0.35];
    actor.shoulder = [-0.5 * c - 0.1, -0.5 * c - 0.1];
    actor.elbow = [0.9 * c + 0.2, 0.9 * c + 0.2];
    actor.headPitch = -0.2 * c;
  }
  private static run(actor: Actor, phase: number, lean = 0.28) {
    const s = Math.sin(phase);
    actor.lean = lean;
    actor.hipDrop = 0.08 - Math.abs(Math.cos(phase)) * 0.04;
    actor.thigh = [s * 0.8, -s * 0.8];
    actor.knee = [0.45 + 0.9 * clamp01(-s), 0.45 + 0.9 * clamp01(s)];
    actor.shoulder = [-0.45 - 0.7 * s, -0.45 + 0.7 * s];
    actor.roll = [0.25, 0.25];
    actor.elbow = [1.5, 1.5];
    actor.headPitch = 0.05;
  }

  private updateActors() {
    const replay = this.replay,
      t = this.progress;
    for (const actor of this.actors) actor.visible = false;
    if (replay) {
      const ballNow = this.ballWorld(t);
      const noContact = NO_CONTACT.includes(replay.kind);
      const chasingAllowed = !noContact && replay.kind !== 'homeRun';
      const stealOnly = replay.play?.plateAppearance === false;
      const destination = this.destination();
      let receiver = '';
      if (destination === bases[1]) receiver = '1B';
      else if (destination === bases[2]) receiver = replay.fielder === '2B' ? 'SS' : '2B';
      Object.entries(fieldPoints).forEach(([pos, point], i) => {
        const actor = this.actors[i];
        actor.visible = true;
        StadiumController.neutral(actor);
        actor.glove = true;
        const chasing = pos === replay.fielder && chasingAllowed && !!replay.play;
        const move = chasing ? clamp01((t - 0.22) / 0.43) : 0;
        const home = toWorld(point);
        let to = toWorld(between(point, replay.target, move));
        if (pos === receiver && replay.play && !stealOnly) {
          const bag = toWorld(destination);
          bag.addScaledVector(new THREE.Vector3().subVectors(home, bag).normalize(), 0.7);
          to = home.lerp(bag, smooth(clamp01((t - 0.45) / 0.25)));
        }
        actor.pos.copy(to);
        const dx = ballNow.x - to.x,
          dz = ballNow.z - to.z;
        actor.yaw = Math.atan2(dx, dz);
        const running =
          (chasing && move > 0 && move < 1) || (pos === receiver && t > 0.45 && t < 0.7);
        if (pos === 'P' && !stealOnly && replay.play) this.posePitcher(actor, t);
        else if (pos === 'C') this.poseCatcher(actor, t, noContact || !replay.play);
        else if (running) {
          StadiumController.run(actor, (chasing ? move * 26 : (t - 0.45) * 40) + i);
          const step = chasing ? Math.min(1, move + 0.02) : 1;
          const ahead = chasing
            ? toWorld(between(point, replay.target, step))
            : toWorld(destination);
          actor.yaw = Math.atan2(ahead.x - to.x, ahead.z - to.z);
        } else if (t < 0.2)
          StadiumController.ready(actor, pos === '1B' || pos === '3B' ? 0.35 : 0.5);
        else {
          StadiumController.ready(actor, 0.15);
          if (chasing) {
            const catchUp = smooth(clamp01((t - 0.56) / 0.09));
            const dropDown = smooth(clamp01((t - 0.68) / 0.06));
            const reach = catchUp * (1 - dropDown);
            actor.shoulder[1] = lerp(actor.shoulder[1], replay.fly ? -2.7 : -1.1, reach);
            actor.elbow[1] = lerp(actor.elbow[1], replay.fly ? 0.2 : 0.4, reach);
            actor.hipDrop = replay.fly ? 0.05 : lerp(0.05, 0.45, reach);
            actor.thigh = replay.fly ? [0, 0] : [-1.1 * reach, -1.1 * reach];
            actor.knee = replay.fly ? [0, 0] : [1.7 * reach, 1.7 * reach];
            actor.lean = replay.fly ? 0.0 : 0.5 * reach;
            actor.headPitch = replay.fly ? -0.6 * reach : 0.4 * reach;
            // Throw: wind back, then whip forward while the ball travels to the base.
            const wind = smooth(clamp01((t - 0.66) / 0.05)),
              whip = smooth(clamp01((t - 0.7) / 0.06));
            if (wind > 0 && destination !== fieldPoints.P) {
              actor.shoulder[0] = lerp(0.9, -2.8, wind) + whip * 3.2;
              actor.roll[0] = 0.6 * (1 - whip);
              actor.elbow[0] = lerp(1.6, 0.3, whip);
              actor.twist = lerp(-0.8, 0.6, whip);
              actor.lean = 0.15 + whip * 0.3;
            }
          }
          if (pos === receiver) {
            const wait = smooth(clamp01((t - 0.78) / 0.08));
            actor.shoulder[1] = lerp(actor.shoulder[1], -1.5, wait);
            actor.elbow[1] = lerp(actor.elbow[1], 0.2, wait);
            actor.thigh = [-0.4 * wait, -1.0 * wait];
            actor.knee = [0.3 * wait, 1.3 * wait];
            actor.hipDrop = 0.15 * wait;
          }
        }
      });
      const runnerProgress = clamp01((t - 0.28) / 0.6);
      replay.runners.slice(0, 4).forEach((runner, i) => {
        const actor = this.actors[9 + i];
        actor.visible = true;
        StadiumController.neutral(actor);
        const point = runnerPoint(runner.from, runner.to, runnerProgress);
        const world = toWorld(point);
        const isBatter = runner.from === 0;
        const moving = runner.to > runner.from && runnerProgress > 0 && runnerProgress < 1;
        if (isBatter && runnerProgress === 0) {
          world.x -= 1.0; // right-handed batter's box (third-base side)
          world.z += 0.05;
        }
        actor.pos.copy(world);
        if (moving) {
          const next = toWorld(
            runnerPoint(runner.from, runner.to, Math.min(1, runnerProgress + 0.02)),
          );
          actor.yaw = Math.atan2(next.x - world.x, next.z - world.z);
          StadiumController.run(
            actor,
            runnerProgress * (runner.to - runner.from) * 22 + i * 2,
            0.32,
          );
        } else if (isBatter && runnerProgress === 0) {
          this.poseBatter(
            actor,
            t,
            stealOnly || replay.kind === 'walk' || replay.kind === 'tiebreak',
          );
        } else if (runner.to > runner.from && runnerProgress >= 1) {
          // Arrived: stand on the bag, look toward the play.
          const base = toWorld(bases[Math.min(4, runner.to)]);
          actor.yaw = Math.atan2(ballNow.x - base.x, ballNow.z - base.z);
          StadiumController.ready(actor, 0.1);
        } else {
          // Leading off before the play develops.
          const nextBase = toWorld(bases[Math.min(4, runner.from + 1)]);
          actor.yaw = Math.atan2(nextBase.x - world.x, nextBase.z - world.z) + Math.PI / 2;
          StadiumController.ready(actor, 0.45);
          actor.pos.lerp(nextBase, 0.06);
        }
        if (runner.out && runnerProgress > 0.9) {
          // Retired runner steps off the bag and eases out of the play.
          actor.pos.x += 1.6;
          actor.pos.z += 1.2;
          StadiumController.neutral(actor);
          actor.lean = 0.3;
          actor.headPitch = 0.5;
        }
      });
      if (!replay.play) {
        // Pre-game / no-play event: batter waiting at the plate.
        const actor = this.actors[9];
        actor.visible = true;
        actor.pos.set(-1.0, 0, 0.05);
        StadiumController.neutral(actor);
        actor.yaw = Math.PI / 2;
        this.poseBatter(actor, 0, true);
      }
    }
    for (const actor of this.actors) this.writeActor(actor);
    for (const mesh of Object.values(this.parts)) mesh.instanceMatrix.needsUpdate = true;
  }

  private posePitcher(actor: Actor, t: number) {
    actor.yaw = Math.atan2(-actor.pos.x, -actor.pos.z); // face home plate
    actor.glove = true;
    const set = clamp01(t / 0.025),
      kick = smooth(clamp01((t - 0.02) / 0.025)),
      stride = smooth(clamp01((t - 0.045) / 0.02)),
      follow = smooth(clamp01((t - PITCH_RELEASE) / 0.05)),
      recover = smooth(clamp01((t - 0.14) / 0.12));
    if (recover >= 1) {
      StadiumController.ready(actor, 0.3);
      return;
    }
    // Set position: hands together at the chest.
    actor.lean = 0.05;
    actor.hipDrop = 0.05;
    actor.shoulder = [-0.9 * set, -0.9 * set];
    actor.elbow = [1.9 * set, 1.9 * set];
    actor.roll = [0.2, 0.2];
    // Leg kick (left leg for a right-hander), then stride toward the plate.
    actor.thigh[1] = lerp(0, -1.5, kick) + stride * 0.9;
    actor.knee[1] = lerp(0, 1.9, kick) * (1 - stride);
    actor.thigh[0] = -0.2 * kick + 0.8 * stride;
    actor.knee[0] = 0.35 * kick;
    actor.twist = -0.6 * kick + (0.6 + 0.9 * follow) * stride;
    // Throwing arm: back and up, then whip forward past release.
    actor.shoulder[0] = lerp(-0.9 * set, 1.6, kick) + lerp(0, -4.2, follow);
    actor.roll[0] = 0.5 * kick;
    actor.elbow[0] = lerp(1.9 * set, 1.3, kick) - 1.0 * follow;
    actor.shoulder[1] = lerp(-0.9 * set, -2.4, kick) + 2.2 * follow;
    actor.elbow[1] = lerp(1.9 * set, 0.6, kick) + follow * 0.8;
    actor.lean = 0.05 - 0.25 * kick + 0.75 * follow;
    actor.hipDrop = 0.05 + 0.3 * stride;
    actor.headPitch = -0.2 * kick + 0.3 * follow;
    if (recover > 0) {
      // Blend to the fielding stance.
      const r = recover;
      actor.lean = lerp(actor.lean, 0.15, r);
      actor.hipDrop = lerp(actor.hipDrop, 0.09, r);
      actor.twist = lerp(actor.twist, 0, r);
      actor.thigh = [lerp(actor.thigh[0], -0.27, r), lerp(actor.thigh[1], -0.27, r)];
      actor.knee = [lerp(actor.knee[0], 0.45, r), lerp(actor.knee[1], 0.45, r)];
      actor.shoulder = [lerp(actor.shoulder[0], -0.25, r), lerp(actor.shoulder[1], -0.25, r)];
      actor.elbow = [lerp(actor.elbow[0], 0.47, r), lerp(actor.elbow[1], 0.47, r)];
      actor.roll = [0.35, 0.35];
      actor.headPitch = lerp(actor.headPitch, 0, r);
    }
  }

  private poseCatcher(actor: Actor, t: number, stayDown: boolean) {
    actor.yaw = Math.PI; // face the mound (model forward is +z)
    actor.glove = true;
    const up = stayDown ? smooth(clamp01((t - 0.45) / 0.15)) : smooth(clamp01((t - 0.2) / 0.1));
    const c = 1 - up;
    actor.hipDrop = 0.58 * c;
    actor.lean = 0.35 * c + 0.1;
    actor.thigh = [-1.75 * c, -1.75 * c];
    actor.knee = [2.3 * c, 2.3 * c];
    actor.roll = [0.55 * c + 0.2, 0.7 * c + 0.2];
    // Glove target out front; throwing hand tucked behind the back.
    const receive = stayDown ? smooth(clamp01((t - 0.3) / 0.08)) : 0;
    actor.shoulder = [0.5 * c - 0.1, (-1.2 - 0.5 * receive) * c - 0.2];
    actor.elbow = [1.3 * c + 0.2, (0.8 - 0.5 * receive) * c + 0.3];
    actor.headPitch = -0.25 * c;
    if (up > 0) {
      actor.shoulder[0] = lerp(actor.shoulder[0], -0.3, up);
      actor.shoulder[1] = lerp(actor.shoulder[1], -0.6, up);
      actor.elbow = [lerp(actor.elbow[0], 0.6, up), lerp(actor.elbow[1], 0.9, up)];
    }
  }

  private poseBatter(actor: Actor, t: number, take: boolean) {
    actor.yaw = Math.PI / 2; // right-handed stance facing across the plate
    actor.glove = false;
    const swing = take ? 0 : smooth(clamp01((t - 0.15) / 0.075));
    const settle = take ? smooth(clamp01((t - 0.25) / 0.12)) : 0;
    // Load → contact → follow-through, driven by torso twist.
    actor.twist = lerp(-0.55, 1.7, swing) * (1 - settle);
    actor.lean = lerp(0.3, 0.15, swing);
    actor.hipDrop = lerp(0.22, 0.28, Math.sin(swing * Math.PI)) * (1 - settle * 0.6);
    actor.thigh = [-0.55 + 0.25 * swing, -0.55 - 0.35 * swing * (1 - settle)];
    actor.knee = [1.0 - 0.6 * swing, 0.9 + 0.2 * swing];
    // Hands start high by the back shoulder, extend through the zone, wrap around the front.
    actor.shoulder = [lerp(-1.1, -1.55, swing), lerp(-1.3, -1.45, swing)];
    actor.roll = [lerp(0.15, 0.45, swing), lerp(0.55, 0.15, swing)];
    actor.elbow = [lerp(2.1, 0.35, swing), lerp(1.55, 0.35, swing)];
    actor.headPitch = 0.15;
    actor.bat = lerp(-0.55, Math.PI / 2 + 0.25, swing);
    actor.batYaw = lerp(0.3, -0.2, swing);
    if (settle > 0) {
      // Took the pitch: relax the bat to the shoulder.
      actor.shoulder = [
        lerp(actor.shoulder[0], -0.6, settle),
        lerp(actor.shoulder[1], -0.7, settle),
      ];
      actor.elbow = [lerp(actor.elbow[0], 1.9, settle), lerp(actor.elbow[1], 1.7, settle)];
      actor.bat = lerp(actor.bat, -0.9, settle);
    }
  }

  private mat(
    parent: THREE.Matrix4,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
    sx = 1,
    sy = 1,
    sz = 1,
  ) {
    const m = this.pool[this.poolIndex++];
    this.dummy.position.set(x, y, z);
    this.dummy.rotation.set(rx, ry, rz);
    this.dummy.scale.set(sx, sy, sz);
    this.dummy.updateMatrix();
    return m.multiplyMatrices(parent, this.dummy.matrix);
  }

  private writeActor(actor: Actor) {
    const { slot } = actor;
    const setPart = (key: PartKey, index: number, matrix: THREE.Matrix4) =>
      this.parts[key].setMatrixAt(slot * PART_COUNT[key] + index, matrix);
    if (!actor.visible) {
      const zero = this.tmpMatrix.makeScale(0, 0, 0);
      for (const key of PART_KEYS) for (let k = 0; k < PART_COUNT[key]; k++) setPart(key, k, zero);
      return;
    }
    this.poolIndex = 0;
    const zero = this.tmpMatrix.makeScale(0, 0, 0);
    const root = this.pool[this.poolIndex++];
    this.dummy.position.copy(actor.pos);
    this.dummy.rotation.set(0, actor.yaw, 0);
    this.dummy.scale.setScalar(0.96);
    this.dummy.updateMatrix();
    root.copy(this.dummy.matrix);
    const hipY = HIP_Y - actor.hipDrop;
    setPart('pelvis', 0, this.mat(root, 0, hipY + 0.06, 0, actor.lean * 0.3, 0, 0));
    const torso = this.mat(root, 0, hipY + 0.12, 0, actor.lean, actor.twist, 0);
    setPart('torso', 0, this.mat(torso, 0, 0.4, 0));
    const head = this.mat(torso, 0, 0.9, 0.03, actor.headPitch, 0, 0);
    setPart('head', 0, head);
    setPart('cap', 0, this.mat(head, 0, 0.02, -0.01));
    setPart('brim', 0, this.mat(head, 0, 0.09, 0.19, 0.18, 0, 0));
    const hands: THREE.Matrix4[] = [];
    for (let i = 0; i < 2; i++) {
      const sideX = i === 0 ? -0.29 : 0.29;
      const shoulder = this.mat(
        torso,
        sideX,
        0.62,
        0,
        actor.shoulder[i],
        0,
        i === 0 ? actor.roll[i] : -actor.roll[i],
      );
      setPart('uarm', i, this.mat(shoulder, 0, -UARM / 2, 0));
      const elbow = this.mat(shoulder, 0, -UARM, 0, -actor.elbow[i], 0, 0);
      setPart('farm', i, this.mat(elbow, 0, -FARM / 2, 0));
      hands.push(this.mat(elbow, 0, -FARM, 0));
    }
    setPart(
      'glove',
      0,
      actor.glove ? this.mat(hands[1], 0, -0.06, 0.03, 0.3, 0, 0, 1, 0.65, 1.25) : zero,
    );
    // Bat sits in the right (rear) hand; its tilt comes from the pose, orientation from the torso.
    if (actor.bat) {
      const hand = this.tmpVec.setFromMatrixPosition(hands[0]);
      const grip = this.mat(torso, 0, 0, 0);
      grip.setPosition(hand);
      setPart('bat', 0, this.mat(grip, 0, 0, 0, actor.bat, actor.batYaw, 0.15));
      // Move the bat so its handle (not its centre) sits in the hand.
      const bat = this.parts.bat;
      bat.getMatrixAt(slot, this.tmpMatrix);
      this.tmpMatrix.multiply(this.dummy.matrix.makeTranslation(0, 0.36, 0));
      bat.setMatrixAt(slot, this.tmpMatrix);
    } else setPart('bat', 0, zero);
    for (let i = 0; i < 2; i++) {
      const hip = this.mat(root, i === 0 ? -0.13 : 0.13, hipY, 0, actor.thigh[i], 0, 0);
      setPart('thigh', i, this.mat(hip, 0, -THIGH / 2, 0));
      const knee = this.mat(hip, 0, -THIGH, 0, actor.knee[i], 0, 0);
      setPart('shin', i, this.mat(knee, 0, -SHIN / 2, 0));
      const flat = -(actor.thigh[i] + actor.knee[i]) * 0.85;
      setPart('shoe', i, this.mat(knee, 0, -SHIN - 0.02, 0.05, flat, 0, 0));
    }
  }

  // ---------------------------------------------------------------- ball
  private destination(): Point {
    const replay = this.replay!;
    return replay.play?.command === 'bunt'
      ? bases[1]
      : replay.kind === 'doublePlay'
        ? bases[2]
        : ['out', 'error'].includes(replay.kind)
          ? bases[1]
          : fieldPoints.P;
  }

  private ballHeight(t: number): number {
    const replay = this.replay!;
    if (replay.play?.plateAppearance === false) {
      const u = clamp01((t - 0.15) / 0.65);
      return lerp(1.5, 0.6, u) + Math.sin(u * Math.PI) * 2.6;
    }
    if (t < 0.2) {
      const u = clamp01((t - PITCH_RELEASE) / (0.2 - PITCH_RELEASE));
      return lerp(1.9, 0.72, u) - Math.sin(u * Math.PI) * 0.1;
    }
    if (NO_CONTACT.includes(replay.kind)) return 0.7;
    if (t < 0.65) {
      const u = (t - 0.2) / 0.45;
      if (replay.fly) {
        const peak =
          replay.kind === 'homeRun'
            ? 26
            : replay.kind === 'triple' || replay.kind === 'double'
              ? 16
              : 11;
        const end = replay.kind === 'sacrifice' ? 1.6 : 0.1;
        return lerp(0.9, end, u) + Math.sin(u * Math.PI) * peak;
      }
      // Ground ball: decaying hops.
      return 0.1 + Math.abs(Math.sin(u * Math.PI * 3)) * 0.9 * (1 - u);
    }
    if (['homeRun', 'double', 'triple'].includes(replay.kind)) return 0.1;
    const u = clamp01((t - 0.65) / 0.25);
    return lerp(1.5, 1.3, u) + Math.sin(u * Math.PI) * 3.5;
  }

  /** Ball position (with height). The pitch segment is re-timed so the wind-up precedes release. */
  private ballWorld(t: number, target = new THREE.Vector3()) {
    const replay = this.replay!;
    if (t < 0.2 && replay.play?.plateAppearance !== false) {
      const u = clamp01((t - PITCH_RELEASE) / (0.2 - PITCH_RELEASE));
      const p = toWorld(between(fieldPoints.P, bases[0], u));
      return target.set(p.x + 0.35 * (1 - u), this.ballHeight(t), p.z);
    }
    const p = toWorld(ballPoint(replay, t));
    return target.set(p.x, this.ballHeight(t), p.z);
  }

  private updateBall() {
    const replay = this.replay,
      t = this.progress;
    const show = !!replay?.play && t > PITCH_RELEASE && t <= 0.94;
    this.ball.visible = show;
    this.ballShadow.visible = show;
    this.trail.visible = show;
    if (!show) return;
    const p = this.ballWorld(t, this.tmpVec);
    this.ball.position.copy(p);
    this.ballShadow.position.set(p.x, 0.07, p.z);
    const s = THREE.MathUtils.clamp(1 + p.y * 0.08, 1, 3);
    this.ballShadow.scale.setScalar(s);
    (this.ballShadow.material as THREE.MeshBasicMaterial).opacity = 0.42 / s;
    const count = this.trailPositions.count;
    for (let i = 0; i < count; i++) {
      const tt = Math.max(PITCH_RELEASE, t - i * 0.009);
      const q = this.ballWorld(tt, this.tmpVec2);
      this.trailPositions.setXYZ(i, q.x, q.y, q.z);
    }
    this.trailPositions.needsUpdate = true;
  }

  // ---------------------------------------------------------------- camera
  private updateCamera() {
    const cam = this.camera,
      t = this.progress,
      replay = this.replay;
    const portrait = cam.aspect < 1;
    let fov = 30,
      cameraCut = false;
    const pos = this.wantPos,
      target = this.wantTarget;
    if (this.mode === 'overview' || !replay) {
      // Fit the whole park: bounding sphere around the stands + outfield seats + scoreboard.
      fov = portrait ? 62 : 46;
      const half = (fov / 2) * (Math.PI / 180);
      const hHalf = Math.atan(Math.tan(half) * cam.aspect);
      const radius = 59;
      const dist = radius / Math.sin(Math.min(half, hHalf)) + 6;
      const a = -0.22 + t * 0.14;
      const dir = new THREE.Vector3(Math.sin(a) * 0.55, 0.78, Math.cos(a) * 0.72).normalize();
      target.set(0, 4, -24);
      pos.copy(target).addScaledVector(dir, dist);
    } else {
      const stealOnly = replay.play?.plateAppearance === false;
      const noContact = NO_CONTACT.includes(replay.kind);
      const ballWorld = this.ballWorld(t, this.tmpVec);
      const runnersMove = replay.runners.some((r) => r.to > r.from);
      const cfPos = new THREE.Vector3(2.4, 4.3, -41),
        cfTarget = new THREE.Vector3(0.1, 1.15, -3.5);
      if (stealOnly) {
        // High-home camera swinging onto the target bag.
        const bag = toWorld(bases[replay.play?.steal?.to || 2]);
        pos.set(-5, 19, 25);
        target.lerpVectors(new THREE.Vector3(0, 1, -8), bag, smooth(clamp01((t - 0.1) / 0.3)));
        fov = 24;
      } else if (!replay.play || t < 0.24 || (noContact && !(runnersMove && t > 0.32))) {
        // Centre-field pitch camera: pitcher in the foreground, batter and catcher framed.
        const push = smooth(clamp01((t - 0.3) / 0.4)) * (noContact ? 1 : 0);
        pos.copy(cfPos).add(new THREE.Vector3(-0.6 * push, -0.4 * push, 2.5 * push));
        target.copy(cfTarget).add(new THREE.Vector3(-0.4 * push, -0.1 * push, 1.5 * push));
        fov = 13.5 - push * 1.5;
      } else {
        // A broadcast cut changes cameras after contact; flying across the diamond makes
        // the ball harder to follow and creates unnecessary motion on a small screen.
        const cutAt = noContact ? 0.32 : 0.24;
        cameraCut = this.lastProgress < cutAt && t >= cutAt;
        const side = replay.target.x >= HOME.x ? -1 : 1;
        const highHome = new THREE.Vector3(side * 8, 22, 27);
        pos.copy(highHome);
        const ballTarget = ballWorld.clone().setY(Math.min(ballWorld.y * 0.5, 8));
        const fielder = toWorld(replay.target).setY(1);
        let follow: THREE.Vector3;
        if (noContact) follow = toWorld(runnerPoint(0, 1, clamp01((t - 0.28) / 0.6))).setY(1);
        else if (t > 0.9) {
          const settle = toWorld(this.destination()).setY(1).lerp(ballTarget, 0.4);
          follow = ballTarget.lerp(settle, clamp01((t - 0.9) / 0.1));
        } else follow = ballTarget.lerp(fielder, replay.kind === 'homeRun' ? 0.15 : 0.35);
        target.copy(follow);
        const dist = target.distanceTo(pos);
        fov = THREE.MathUtils.clamp(2600 / dist, 18, 36);
        if (replay.kind === 'homeRun' && t > 0.4) fov = Math.max(fov, 34);
      }
    }
    if (portrait) fov *= 1.3;
    // Track smoothly within a shot, but cut directly between the pitch and field cameras.
    const jump = Math.abs(t - this.lastProgress) > 0.12 || this.lastProgress < 0;
    if (this.snapCamera || jump || cameraCut) {
      this.camPos.copy(pos);
      this.camTarget.copy(target);
      this.camFov = fov;
      this.snapCamera = false;
    } else {
      const k = 0.32;
      this.camPos.lerp(pos, k);
      this.camTarget.lerp(target, k);
      this.camFov = lerp(this.camFov, fov, k);
    }
    cam.position.copy(this.camPos);
    cam.fov = this.camFov;
    cam.lookAt(this.camTarget);
    cam.updateProjectionMatrix();
  }
}

export function createStadium(
  canvas: HTMLCanvasElement,
  options: { mobile: boolean; onLost: () => void; onRestored: () => void },
) {
  return new StadiumController(canvas, options);
}
