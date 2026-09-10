// Procedural three.js stadium. Loaded lazily by stadium-3d.tsx so `three` stays out of the
// main bundle. Everything is generated in code (no external models or textures); motion is a
// pure function of the shared replay math (`ballPoint` / `runnerPoint`) and never alters results.
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
const shapePoint = (p: Point) => new THREE.Vector2((p.x - HOME.x) * SCALE, (HOME.y - p.y) * SCALE);
const quad = (a: Point, c: Point, b: Point, t: number): Point => {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
};
const LEFT_POLE = { x: 186, y: 350 },
  RIGHT_POLE = { x: 1350, y: 350 },
  FENCE_CTRL = { x: 768, y: -120 },
  FENCE_SAMPLES = 40;
const fenceArc = (inset = 0) =>
  Array.from({ length: FENCE_SAMPLES + 1 }, (_, i) => {
    const p = quad(LEFT_POLE, FENCE_CTRL, RIGHT_POLE, i / FENCE_SAMPLES);
    if (!inset) return p;
    const dx = p.x - HOME.x,
      dy = p.y - HOME.y,
      len = Math.hypot(dx, dy);
    return { x: p.x - (dx / len) * inset, y: p.y - (dy / len) * inset };
  });

const PLAYER_SLOTS = 14; // 9 fielders + batter + up to 3 runners (+ spare)
type PartKey = 'head' | 'cap' | 'torso' | 'arm' | 'leg';
const PART_COUNT: Record<PartKey, number> = { head: 1, cap: 1, torso: 1, arm: 2, leg: 2 };

type Actor = {
  slot: number;
  pos: THREE.Vector3;
  yaw: number;
  gait: number; // 0..1 running phase strength
  phase: number; // radians for leg swing
  armL: number; // shoulder pitch (radians), positive = forward/up
  armR: number;
  crouch: number; // 0..1
  lean: number; // torso twist (radians)
  visible: boolean;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
const NO_CONTACT = ['walk', 'strikeout', 'tiebreak'];

function stripeTexture(a: string, b: string) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = b;
  ctx.fillRect(0, 0, 128, 256);
  // Blade noise so the stripes do not look like flat paint.
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * 256,
      y = Math.random() * 256;
    ctx.fillStyle = Math.random() > 0.5 ? '#ffffff10' : '#00000014';
    ctx.fillRect(x, y, 1.5, 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function shapeMesh(
  points: Point[],
  material: THREE.Material,
  height: number,
  holes: Point[][] = [],
) {
  const shape = new THREE.Shape(points.map(shapePoint));
  for (const hole of holes) shape.holes.push(new THREE.Path(hole.map(shapePoint)));
  const geometry = new THREE.ShapeGeometry(shape, 8);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = height;
  mesh.receiveShadow = true;
  return mesh;
}

/** Vertical ribbon (wall) following a polyline. */
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

/**
 * Stepped seating bowl along a 2D path. Each tier = seat surface + riser. Vertex colours carry
 * a crowd pattern so the whole bowl is one draw call.
 */
function standsGeometry(
  path: { p: THREE.Vector3; n: THREE.Vector3 }[],
  tiers: { depth: number; rise: number; gap?: number }[],
  startHeight: number,
  seed: number,
) {
  const positions: number[] = [],
    normals: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const seatIndices: number[] = []; // vertex index of seat vertices (for recolouring)
  let offset = 0,
    height = startHeight;
  const push = (v: THREE.Vector3, n: THREE.Vector3, color: THREE.Color) => {
    positions.push(v.x, v.y, v.z);
    normals.push(n.x, n.y, n.z);
    colors.push(color.r, color.g, color.b);
    return positions.length / 3 - 1;
  };
  const strip = (
    inner: (i: number) => THREE.Vector3,
    outer: (i: number) => THREE.Vector3,
    normal: (i: number) => THREE.Vector3,
    color: (i: number) => THREE.Color,
    seat: boolean,
  ) => {
    let prevA = -1,
      prevB = -1;
    for (let i = 0; i < path.length; i++) {
      const c = color(i),
        n = normal(i);
      const a = push(inner(i), n, c),
        b = push(outer(i), n, c);
      if (seat) seatIndices.push(a, b);
      if (i > 0) indices.push(prevA, a, prevB, prevB, a, b);
      prevA = a;
      prevB = b;
    }
  };
  const concrete = new THREE.Color('#8e8f96');
  let k = seed;
  const rand = () => (k = (k * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (const tier of tiers) {
    const innerOffset = offset,
      outerOffset = offset + tier.depth,
      h = height;
    strip(
      (i) => path[i].p.clone().addScaledVector(path[i].n, innerOffset).setY(h),
      (i) => path[i].p.clone().addScaledVector(path[i].n, outerOffset).setY(h),
      () => new THREE.Vector3(0, 1, 0),
      () => concrete.clone().offsetHSL(0, 0, (rand() - 0.5) * 0.06),
      true,
    );
    strip(
      (i) => path[i].p.clone().addScaledVector(path[i].n, outerOffset).setY(h),
      (i) =>
        path[i].p
          .clone()
          .addScaledVector(path[i].n, outerOffset)
          .setY(h + tier.rise),
      (i) => path[i].n.clone().negate(),
      () => concrete.clone().multiplyScalar(0.75),
      false,
    );
    offset = outerOffset;
    height = h + tier.rise;
    if (tier.gap) {
      // Walkway between decks.
      strip(
        (i) => path[i].p.clone().addScaledVector(path[i].n, offset).setY(height),
        (i) =>
          path[i].p
            .clone()
            .addScaledVector(path[i].n, offset + tier.gap!)
            .setY(height),
        () => new THREE.Vector3(0, 1, 0),
        () => concrete.clone().multiplyScalar(0.9),
        false,
      );
      offset += tier.gap;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return { geometry, seatIndices, topHeight: height, topOffset: offset };
}

export class StadiumController {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1.5, 0.5, 900);
  private readonly sun: THREE.DirectionalLight;
  private readonly parts: Record<PartKey, THREE.InstancedMesh>;
  private readonly ball: THREE.Mesh;
  private readonly disposables: { dispose(): void }[] = [];
  private readonly stands: { geometry: THREE.BufferGeometry; seatIndices: number[] };
  private readonly boardPanels: [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial];
  private replay: ReplaySceneData | null = null;
  private colors = { attack: '#c8102e', defend: '#0c2340' };
  private mode: CameraMode = 'broadcast';
  private progress = 0;
  private frame = 0;
  private lost = false;
  private readonly dummy = new THREE.Object3D();
  private readonly tmpMatrix = new THREE.Matrix4();
  private readonly tmpRoot = new THREE.Matrix4();
  private readonly tmpVec = new THREE.Vector3();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly lookTarget = new THREE.Vector3();
  private readonly actors: Actor[] = Array.from({ length: PLAYER_SLOTS }, (_, slot) => ({
    slot,
    pos: new THREE.Vector3(),
    yaw: 0,
    gait: 0,
    phase: 0,
    armL: 0,
    armR: 0,
    crouch: 0,
    lean: 0,
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
    this.renderer.toneMappingExposure = 1.05;
    canvas.addEventListener('webglcontextlost', this.handleLost);
    canvas.addEventListener('webglcontextrestored', this.handleRestored);

    this.scene.fog = new THREE.Fog('#b9d4ec', 140, 520);
    this.sun = this.buildLights();
    this.buildSky();
    this.buildField();
    this.buildFence();
    const stands = this.buildStands();
    this.stands = stands;
    this.boardPanels = this.buildScoreboard();
    this.buildTowers();
    this.parts = this.buildPlayers();
    this.ball = this.buildBall();
    this.setCrowdColors();
  }

  // ---------------------------------------------------------------- construction
  private track<T extends { dispose(): void }>(item: T) {
    this.disposables.push(item);
    return item;
  }
  private material(params: THREE.MeshStandardMaterialParameters) {
    return this.track(new THREE.MeshStandardMaterial(params));
  }
  private add(mesh: THREE.Object3D) {
    if (mesh instanceof THREE.Mesh && !this.disposables.includes(mesh.geometry))
      this.track(mesh.geometry);
    this.scene.add(mesh);
    return mesh;
  }

  private buildLights() {
    const hemi = new THREE.HemisphereLight('#dbe9ff', '#667787', 2.0);
    this.scene.add(new THREE.AmbientLight('#dbe7f3', 0.5));
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff3dc', 2.6);
    sun.position.set(-48, 70, 34);
    sun.target.position.set(0, 0, -22);
    sun.castShadow = true;
    const size = this.options.mobile ? 1024 : 2048;
    sun.shadow.mapSize.set(size, size);
    sun.shadow.camera.near = 20;
    sun.shadow.camera.far = 220;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -85;
    sun.shadow.camera.right = sun.shadow.camera.top = 85;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);
    return sun;
  }

  private buildSky() {
    const geometry = this.track(new THREE.SphereGeometry(420, 24, 12));
    const colors: number[] = [];
    const top = new THREE.Color('#3f7fd2'),
      horizon = new THREE.Color('#d7e6f5'),
      pos = geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const t = clamp01(pos.getY(i) / 420);
      const c = horizon.clone().lerp(top, Math.pow(t, 0.6));
      colors.push(c.r, c.g, c.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const material = this.track(
      new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }),
    );
    this.add(new THREE.Mesh(geometry, material));
  }

  private buildField() {
    const grassTexture = this.track(stripeTexture('#3a7a45', '#347040'));
    grassTexture.repeat.set(1 / 7, 1 / 7);
    const grass = this.material({ map: grassTexture, roughness: 0.95, metalness: 0 });
    const dirt = this.material({ color: '#a8845a', roughness: 1 });
    const clay = this.material({ color: '#b0895e', roughness: 1 });
    const ground = this.material({ color: '#27412a', roughness: 1 });
    const chalk = this.material({ color: '#f6efdc', roughness: 0.8 });

    const plane = new THREE.Mesh(this.track(new THREE.PlaneGeometry(700, 700)), ground);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(0, -0.02, -40);
    plane.receiveShadow = true;
    this.add(plane);

    // Warning track + foul territory dirt (matches the 2D art's outer dirt path).
    const outerArc = Array.from({ length: FENCE_SAMPLES + 1 }, (_, i) =>
      quad({ x: 160, y: 350 }, { x: 768, y: -165 }, { x: 1376, y: 350 }, i / FENCE_SAMPLES),
    );
    this.add(shapeMesh([...outerArc, { x: 818, y: 960 }, { x: 718, y: 960 }], dirt, 0.0));
    // Fair-territory grass.
    this.add(shapeMesh([...fenceArc(48), { x: 768, y: 921 }], grass, 0.012));
    // Infield dirt diamond and the inner grass.
    this.add(
      shapeMesh(
        [bases[0], bases[3], bases[2], bases[1]].map((b) => ({ ...b })),
        clay,
        0.024,
      ),
    );
    this.add(
      shapeMesh(
        [
          { x: 768, y: 807 },
          { x: 585, y: 633 },
          { x: 768, y: 489 },
          { x: 951, y: 633 },
        ],
        grass,
        0.036,
      ),
    );
    // Mound with rubber.
    const moundPos = toWorld(fieldPoints.P);
    const mound = new THREE.Mesh(this.track(new THREE.CylinderGeometry(2.4, 3.3, 0.32, 28)), clay);
    mound.position.set(moundPos.x, 0.16, moundPos.z);
    mound.castShadow = mound.receiveShadow = true;
    this.add(mound);
    const rubber = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.6, 0.06, 0.16)), chalk);
    rubber.position.set(moundPos.x, 0.34, moundPos.z);
    this.add(rubber);
    // Home plate circle and plate.
    const circle = new THREE.Mesh(this.track(new THREE.CircleGeometry(4.2, 32)), clay);
    circle.rotation.x = -Math.PI / 2;
    circle.position.set(0, 0.03, 0);
    circle.receiveShadow = true;
    this.add(circle);
    const plateShape = new THREE.Shape([
      new THREE.Vector2(-0.22, 0.22),
      new THREE.Vector2(0.22, 0.22),
      new THREE.Vector2(0.22, 0),
      new THREE.Vector2(0, -0.22),
      new THREE.Vector2(-0.22, 0),
    ]);
    const plate = new THREE.Mesh(this.track(new THREE.ShapeGeometry(plateShape)), chalk);
    plate.rotation.x = -Math.PI / 2;
    plate.position.set(0, 0.045, 0);
    this.add(plate);
    // Bases (one instanced mesh, 3 instances).
    const baseMesh = new THREE.InstancedMesh(
      this.track(new THREE.BoxGeometry(0.42, 0.1, 0.42)),
      chalk,
      3,
    );
    for (let i = 1; i <= 3; i++) {
      const b = toWorld(bases[i]);
      this.dummy.position.set(b.x, 0.08, b.z);
      this.dummy.rotation.set(0, Math.PI / 4, 0);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      baseMesh.setMatrixAt(i - 1, this.dummy.matrix);
    }
    baseMesh.castShadow = true;
    this.add(baseMesh);
    // Foul lines.
    for (const pole of [LEFT_POLE, RIGHT_POLE]) {
      const end = toWorld(pole),
        len = end.length();
      const line = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.16, 0.02, len)), chalk);
      line.position.copy(end).multiplyScalar(0.5).setY(0.05);
      line.rotation.y = Math.atan2(end.x, end.z) + Math.PI;
      this.add(line);
    }
    // Batter's boxes as thin frames.
    for (const side of [-1, 1]) {
      const frame = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.2, 0.02, 1.8)), chalk);
      frame.position.set(side * 0.95, 0.04, 0.05);
      this.add(frame);
      const inner = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.0, 0.03, 1.6)), clay);
      inner.position.set(side * 0.95, 0.045, 0.05);
      this.add(inner);
    }
  }

  private buildFence() {
    const path = fenceArc().map(toWorld);
    const pad = this.material({ color: '#1f4a3a', roughness: 0.9, side: THREE.DoubleSide });
    const wall = new THREE.Mesh(this.track(wallGeometry(path, 3.2)), pad);
    wall.castShadow = wall.receiveShadow = true;
    this.add(wall);
    const rail = new THREE.Mesh(
      this.track(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(path.map((p) => p.clone().setY(3.2))),
          FENCE_SAMPLES * 2,
          0.09,
          6,
          false,
        ),
      ),
      this.material({ color: '#f2c600', roughness: 0.6 }),
    );
    this.add(rail);
    const yellow = this.material({ color: '#f5d21b', roughness: 0.5 });
    const poleGeo = this.track(new THREE.CylinderGeometry(0.12, 0.12, 14, 8));
    for (const p of [path[0], path[path.length - 1]]) {
      const pole = new THREE.Mesh(poleGeo, yellow);
      pole.position.set(p.x, 7, p.z);
      pole.castShadow = true;
      this.add(pole);
    }
    // Outfield berm behind fence: a low dark band of grass so the fence is not floating.
    const bermPath = fenceArc(-70).map(toWorld);
    const berm = new THREE.Mesh(
      this.track(wallGeometry(bermPath, 1.4, 0)),
      this.material({ color: '#2f5b33', roughness: 1, side: THREE.DoubleSide }),
    );
    this.add(berm);
  }

  private buildStands() {
    // Control points hug the foul lines (offset outward) and wrap behind home plate.
    const lineOffset = 112;
    const along = (pole: Point, t: number, nx: number, ny: number): Point => ({
      x: HOME.x + (pole.x - HOME.x) * t + nx * lineOffset,
      y: HOME.y + (pole.y - HOME.y) * t + ny * lineOffset,
    });
    const nL = { x: -0.6641, y: 0.7476 },
      nR = { x: 0.6641, y: 0.7476 };
    const control: Point[] = [
      ...[0.98, 0.8, 0.6, 0.42, 0.26].map((t) => along(LEFT_POLE, t, nL.x, nL.y)),
      { x: 768, y: 867 + lineOffset + 42 },
      ...[0.26, 0.42, 0.6, 0.8, 0.98].map((t) => along(RIGHT_POLE, t, nR.x, nR.y)),
    ];
    const curve = new THREE.CatmullRomCurve3(control.map(toWorld), false, 'centripetal', 0.5);
    const samples = curve.getSpacedPoints(96);
    const fieldCenter = toWorld({ x: 768, y: 560 });
    const path = samples.map((p, i) => {
      const prev = samples[Math.max(0, i - 1)],
        next = samples[Math.min(samples.length - 1, i + 1)];
      const tangent = new THREE.Vector3().subVectors(next, prev).normalize();
      const n = new THREE.Vector3(-tangent.z, 0, tangent.x);
      if (n.dot(new THREE.Vector3().subVectors(p, fieldCenter)) < 0) n.negate();
      return { p: p.setY(0), n };
    });
    const tiers: { depth: number; rise: number; gap?: number }[] = [
      ...Array.from({ length: 9 }, () => ({ depth: 1.1, rise: 0.62 })),
      { depth: 1.1, rise: 0.62, gap: 2.4 },
      ...Array.from({ length: 12 }, () => ({ depth: 1.05, rise: 0.78 })),
    ];
    const built = standsGeometry(path, tiers, 1.4, 7);
    this.track(built.geometry);
    const mesh = new THREE.Mesh(
      built.geometry,
      this.material({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }),
    );
    mesh.receiveShadow = true;
    this.add(mesh);
    // A single instanced crowd mesh keeps the seating legible from broadcast cameras.
    const crowd = new THREE.InstancedMesh(
      this.track(new THREE.CapsuleGeometry(0.19, 0.38, 2, 4)),
      this.material({ roughness: 1 }),
      path.length * tiers.length,
    );
    const palette = ['#ddd9cf', '#365a80', '#b48465', '#7893ad', '#a8b3c2', '#d3c8aa'];
    let rowOffset = 0,
      rowHeight = 1.4,
      person = 0;
    for (const tier of tiers) {
      for (let i = 0; i < path.length; i++) {
        const point = path[i].p.clone().addScaledVector(path[i].n, rowOffset + tier.depth * 0.5);
        this.dummy.position.set(point.x, rowHeight + 0.42, point.z);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.setScalar(1);
        this.dummy.updateMatrix();
        crowd.setMatrixAt(person, this.dummy.matrix);
        crowd.setColorAt(person, new THREE.Color(palette[(i * 13 + person * 7) % palette.length]));
        person++;
      }
      rowOffset += tier.depth + (tier.gap || 0);
      rowHeight += tier.rise;
    }
    crowd.instanceMatrix.needsUpdate = true;
    this.add(crowd);
    // Front wall between field and first row.
    const wall = new THREE.Mesh(
      this.track(
        wallGeometry(
          path.map((s) => s.p),
          1.4,
        ),
      ),
      this.material({ color: '#264a72', roughness: 0.8, side: THREE.DoubleSide }),
    );
    wall.castShadow = wall.receiveShadow = true;
    this.add(wall);
    // Back wall + cantilever roof over the upper deck.
    const back = path.map((s) => s.p.clone().addScaledVector(s.n, built.topOffset));
    const backWall = new THREE.Mesh(
      this.track(wallGeometry(back, 6, built.topHeight)),
      this.material({ color: '#4c5566', roughness: 0.9, side: THREE.DoubleSide }),
    );
    backWall.castShadow = true;
    this.add(backWall);
    const roofInner = path.map((s) =>
      s.p
        .clone()
        .addScaledVector(s.n, built.topOffset - 12)
        .setY(built.topHeight + 6),
    );
    const roofOuter = back.map((p) => p.clone().setY(built.topHeight + 6.6));
    const roofPositions: number[] = [],
      roofIndex: number[] = [];
    for (let i = 0; i < roofInner.length; i++) {
      roofPositions.push(
        roofInner[i].x,
        roofInner[i].y,
        roofInner[i].z,
        roofOuter[i].x,
        roofOuter[i].y,
        roofOuter[i].z,
      );
      if (i > 0) {
        const a = (i - 1) * 2;
        roofIndex.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const roofGeo = this.track(new THREE.BufferGeometry());
    roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(roofPositions, 3));
    roofGeo.setIndex(roofIndex);
    roofGeo.computeVertexNormals();
    const roof = new THREE.Mesh(
      roofGeo,
      this.material({ color: '#d9dde3', roughness: 0.6, side: THREE.DoubleSide }),
    );
    roof.castShadow = true;
    this.add(roof);
    return { geometry: built.geometry, seatIndices: built.seatIndices };
  }

  private buildScoreboard(): [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial] {
    const cf = toWorld({ x: 768, y: 115 });
    const frame = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(22, 9, 0.8)),
      this.material({ color: '#1b2230', roughness: 0.7 }),
    );
    frame.position.set(cf.x, 9.5, cf.z - 9);
    frame.castShadow = true;
    this.add(frame);
    const screen = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(20, 6.2)),
      this.material({ color: '#0d1420', emissive: '#16324f', emissiveIntensity: 0.8 }),
    );
    screen.position.set(cf.x, 10.4, cf.z - 8.55);
    this.add(screen);
    const stripGeo = this.track(new THREE.PlaneGeometry(9, 1.2));
    const left = this.material({ color: '#c8102e', emissive: '#c8102e', emissiveIntensity: 0.6 });
    const right = this.material({ color: '#0c2340', emissive: '#0c2340', emissiveIntensity: 0.6 });
    const a = new THREE.Mesh(stripGeo, left),
      b = new THREE.Mesh(stripGeo, right);
    a.position.set(cf.x - 5, 6.6, cf.z - 8.5);
    b.position.set(cf.x + 5, 6.6, cf.z - 8.5);
    this.add(a);
    this.add(b);
    const legGeo = this.track(new THREE.BoxGeometry(0.6, 5, 0.6));
    const legMat = this.material({ color: '#2b313c', roughness: 0.9 });
    for (const x of [-8, 8]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(cf.x + x, 2.5, cf.z - 9);
      this.add(leg);
    }
    return [left, right];
  }

  private buildTowers() {
    const poleGeo = this.track(new THREE.CylinderGeometry(0.35, 0.5, 30, 8));
    const bankGeo = this.track(new THREE.BoxGeometry(5, 2.2, 0.8));
    const steel = this.material({ color: '#8a919c', roughness: 0.6, metalness: 0.4 });
    const lamp = this.material({ color: '#fff8e0', emissive: '#fff1c0', emissiveIntensity: 1.2 });
    const spots: Point[] = [
      { x: 120, y: 420 },
      { x: 1416, y: 420 },
      { x: 400, y: 20 },
      { x: 1136, y: 20 },
    ];
    for (const s of spots) {
      const p = toWorld(s);
      const pole = new THREE.Mesh(poleGeo, steel);
      pole.position.set(p.x, 15, p.z);
      pole.castShadow = true;
      this.add(pole);
      const bank = new THREE.Mesh(bankGeo, lamp);
      bank.position.set(p.x, 30.5, p.z);
      bank.lookAt(0, 0, -22);
      this.add(bank);
    }
  }

  private buildPlayers(): Record<PartKey, THREE.InstancedMesh> {
    const make = (geometry: THREE.BufferGeometry, key: PartKey) => {
      const mesh = new THREE.InstancedMesh(
        this.track(geometry),
        this.material({ roughness: 0.75 }),
        PLAYER_SLOTS * PART_COUNT[key],
      );
      mesh.castShadow = true;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      this.add(mesh);
      return mesh;
    };
    return {
      head: make(new THREE.SphereGeometry(0.15, 14, 10), 'head'),
      cap: make(new THREE.CylinderGeometry(0.165, 0.15, 0.11, 12), 'cap'),
      torso: make(new THREE.CapsuleGeometry(0.2, 0.34, 4, 10), 'torso'),
      arm: make(new THREE.CapsuleGeometry(0.065, 0.46, 3, 8), 'arm'),
      leg: make(new THREE.CapsuleGeometry(0.085, 0.5, 3, 8), 'leg'),
    };
  }

  private buildBall() {
    const ball = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(0.16, 12, 8)),
      this.material({ color: '#fbfbf5', roughness: 0.5 }),
    );
    ball.castShadow = true;
    ball.visible = false;
    this.add(ball);
    return ball;
  }

  // ---------------------------------------------------------------- state updates
  private setCrowdColors() {
    const attr = this.stands.geometry.getAttribute('color') as THREE.BufferAttribute;
    const palette = [
      new THREE.Color('#e9e6dd'),
      new THREE.Color('#2a2f3a'),
      new THREE.Color('#6d7481'),
      new THREE.Color('#b8b3a6'),
      new THREE.Color(this.colors.attack),
      new THREE.Color(this.colors.defend),
      new THREE.Color(this.colors.defend),
    ];
    let k = 11;
    const rand = () => (k = (k * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (const index of this.stands.seatIndices) {
      const c = palette[Math.floor(rand() * palette.length)]
        .clone()
        .offsetHSL(0, 0, (rand() - 0.5) * 0.16);
      attr.setXYZ(index, c.r, c.g, c.b);
    }
    attr.needsUpdate = true;
  }

  setReplay(replay: ReplaySceneData, attackColor: string, defendColor: string) {
    const recolor = attackColor !== this.colors.attack || defendColor !== this.colors.defend;
    this.replay = replay;
    this.colors = {
      attack: attackColor || this.colors.attack,
      defend: defendColor || this.colors.defend,
    };
    if (recolor) {
      this.setCrowdColors();
      this.boardPanels[0].color.set(this.colors.attack);
      this.boardPanels[0].emissive.set(this.colors.attack);
      this.boardPanels[1].color.set(this.colors.defend);
      this.boardPanels[1].emissive.set(this.colors.defend);
    }
    this.applyUniforms();
  }

  private applyUniforms() {
    const attack = new THREE.Color(this.colors.attack),
      defend = new THREE.Color(this.colors.defend);
    const skinTones = ['#e8b38a', '#c98a5f', '#8d5a3b', '#f0c9a8', '#6e4429'];
    for (let slot = 0; slot < PLAYER_SLOTS; slot++) {
      const attacking = slot >= 9;
      const jersey = attacking ? attack : defend;
      const pants = attacking
        ? new THREE.Color('#f3f1ea')
        : new THREE.Color('#d9d9d9').lerp(defend, 0.15);
      const skin = new THREE.Color(skinTones[(slot * 7) % skinTones.length]);
      this.parts.head.setColorAt(slot, skin);
      this.parts.cap.setColorAt(slot, jersey.clone().multiplyScalar(0.8));
      this.parts.torso.setColorAt(slot, jersey);
      this.parts.arm.setColorAt(slot * 2, jersey.clone().lerp(skin, 0.55));
      this.parts.arm.setColorAt(slot * 2 + 1, jersey.clone().lerp(skin, 0.55));
      this.parts.leg.setColorAt(slot * 2, pants);
      this.parts.leg.setColorAt(slot * 2 + 1, pants);
    }
    for (const mesh of Object.values(this.parts))
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  setCamera(mode: CameraMode) {
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
    this.options.onRestored();
    this.requestRender();
  };

  // ---------------------------------------------------------------- per-frame maths
  private updateActors() {
    const replay = this.replay,
      t = this.progress;
    for (const actor of this.actors) actor.visible = false;
    if (replay) {
      const ballNow = ballPoint(replay, t);
      const ballWorld = toWorld(ballNow);
      const chasingAllowed = !NO_CONTACT.includes(replay.kind) && replay.kind !== 'homeRun';
      Object.entries(fieldPoints).forEach(([pos, point], i) => {
        const actor = this.actors[i];
        actor.visible = true;
        const chasing = pos === replay.fielder && chasingAllowed;
        const move = chasing ? clamp01((t - 0.22) / 0.43) : 0;
        const from = toWorld(point),
          to = toWorld(between(point, replay.target, move));
        actor.pos.copy(to);
        actor.gait = chasing && move > 0 && move < 1 ? 1 : 0;
        actor.phase = move * 26;
        actor.crouch = pos === 'C' ? 0.8 : 0;
        actor.lean = 0;
        if (pos === 'P') {
          // Wind-up during the pitch, then follow through.
          const wind = clamp01(t / 0.12),
            release = clamp01((t - 0.12) / 0.1);
          actor.armR = lerp(0.3, 2.9, smooth(wind)) - release * 3.4;
          actor.armL = lerp(0.2, 1.4, smooth(wind)) - release * 1.6;
          actor.lean = -release * 0.35;
          actor.yaw = Math.atan2(-from.x, -from.z); // face home plate
        } else {
          // Face the ball; raise glove when the ball arrives.
          const dx = ballWorld.x - to.x,
            dz = ballWorld.z - to.z;
          actor.yaw = Math.atan2(dx, dz);
          const near = chasing ? smooth(clamp01((move - 0.7) / 0.3)) : 0;
          const glove = near * clamp01((t - 0.55) / 0.1);
          actor.armL = glove * 2.4;
          actor.armR =
            chasing && t > 0.68 && t < 0.9 ? Math.sin(((t - 0.68) / 0.22) * Math.PI) * 2.6 : 0;
          if (pos === 'C') {
            actor.yaw = Math.PI; // face the mound (model forward is +z)
            actor.armL = actor.armR = 0.9;
          }
        }
      });
      const runnerProgress = clamp01((t - 0.28) / 0.6);
      const stealOnly = replay.play?.plateAppearance === false;
      replay.runners.slice(0, 4).forEach((runner, i) => {
        const actor = this.actors[9 + i];
        actor.visible = true;
        const point = runnerPoint(runner.from, runner.to, runnerProgress);
        const world = toWorld(point);
        const isBatter = runner.from === 0;
        const moving = runner.to > runner.from && runnerProgress > 0 && runnerProgress < 1;
        if (isBatter && runnerProgress === 0) {
          world.x -= 1.0; // left-hand batter's box
          world.z += 0.05;
        }
        actor.pos.copy(world);
        actor.gait = moving ? 1 : 0;
        actor.phase = runnerProgress * (runner.to - runner.from) * 22;
        actor.crouch = 0;
        actor.lean = 0;
        actor.armL = actor.armR = 0;
        if (moving) {
          const next = toWorld(
            runnerPoint(runner.from, runner.to, Math.min(1, runnerProgress + 0.02)),
          );
          actor.yaw = Math.atan2(next.x - world.x, next.z - world.z);
        } else if (isBatter && runnerProgress === 0) {
          actor.yaw = Math.PI / 2; // batter faces across the plate
          // Load, swing, follow-through.
          const swing = clamp01((t - 0.15) / 0.09);
          actor.armR = lerp(1.2, 0.6, swing);
          actor.armL = lerp(1.2, 0.6, swing);
          actor.lean = stealOnly ? 0 : lerp(-0.7, 1.4, smooth(swing));
          actor.crouch = 0.25;
        } else {
          const base = toWorld(bases[Math.min(4, runner.to)]);
          actor.yaw = Math.atan2(-base.x, -base.z);
        }
        if (runner.out && runnerProgress > 0.9) {
          // Retired runner steps off the bag and eases out of the play.
          actor.pos.x += 1.6;
          actor.pos.z += 1.2;
          actor.crouch = 0.6;
        }
      });
      if (!replay.play) {
        // Pre-game / no-play event: batter waiting at the plate.
        const actor = this.actors[9];
        actor.visible = true;
        actor.pos.set(-1.0, 0, 0.05);
        actor.yaw = Math.PI / 2;
        actor.gait = 0;
        actor.crouch = 0.2;
        actor.armL = actor.armR = 1.1;
        actor.lean = -0.5;
      }
    }
    for (const actor of this.actors) this.writeActor(actor);
    for (const mesh of Object.values(this.parts)) mesh.instanceMatrix.needsUpdate = true;
  }

  private writeActor(actor: Actor) {
    const { slot } = actor;
    const setPart = (key: PartKey, index: number, matrix: THREE.Matrix4) =>
      this.parts[key].setMatrixAt(slot * PART_COUNT[key] + index, matrix);
    if (!actor.visible) {
      const zero = this.tmpMatrix.makeScale(0, 0, 0);
      setPart('head', 0, zero);
      setPart('cap', 0, zero);
      setPart('torso', 0, zero);
      setPart('arm', 0, zero);
      setPart('arm', 1, zero);
      setPart('leg', 0, zero);
      setPart('leg', 1, zero);
      return;
    }
    const crouchDrop = actor.crouch * 0.35;
    this.tmpQuat.setFromAxisAngle(this.tmpVec.set(0, 1, 0), actor.yaw);
    this.tmpRoot.compose(actor.pos, this.tmpQuat, this.tmpVec.set(1, 1, 1));
    const local = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, pivotOffset = 0) => {
      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(rx, ry, rz);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      if (pivotOffset) {
        // Limb geometry is centred; shift it so it hangs from the pivot.
        this.tmpMatrix.makeTranslation(0, pivotOffset, 0);
        this.dummy.matrix.multiply(this.tmpMatrix);
      }
      return this.tmpMatrix.multiplyMatrices(this.tmpRoot, this.dummy.matrix);
    };
    const swing = actor.gait ? Math.sin(actor.phase) * 0.9 : 0;
    const bob = actor.gait ? Math.abs(Math.sin(actor.phase)) * 0.06 : 0;
    const hipY = 0.9 - crouchDrop + bob;
    const torsoY = hipY + 0.42,
      headY = hipY + 0.86,
      capY = headY + 0.12;
    const lean = actor.gait ? 0.18 : actor.crouch * 0.5;
    setPart('torso', 0, local(0, torsoY, 0, lean, actor.lean, 0));
    setPart('head', 0, local(Math.sin(actor.lean) * 0.05, headY, lean * 0.15, 0, actor.lean, 0));
    setPart(
      'cap',
      0,
      local(Math.sin(actor.lean) * 0.05, capY, lean * 0.15 - 0.01, 0, actor.lean, 0),
    );
    // Arms hang from the shoulders (y = torsoY + 0.25), legs from the hips.
    const shoulderY = torsoY + 0.24;
    const armSwingL = actor.gait ? -swing * 0.8 : -actor.armL;
    const armSwingR = actor.gait ? swing * 0.8 : -actor.armR;
    setPart('arm', 0, local(-0.27, shoulderY, 0, armSwingL, actor.lean, 0.12, -0.24));
    setPart('arm', 1, local(0.27, shoulderY, 0, armSwingR, actor.lean, -0.12, -0.24));
    const kneeBend = actor.crouch * 0.9;
    setPart('leg', 0, local(-0.12, hipY, 0, swing * 0.8 - kneeBend, 0, 0, -0.3));
    setPart('leg', 1, local(0.12, hipY, 0, -swing * 0.8 - kneeBend, 0, 0, -0.3));
  }

  private ballHeight(t: number): number {
    const replay = this.replay!;
    if (replay.play?.plateAppearance === false) {
      const u = clamp01((t - 0.15) / 0.65);
      return lerp(1.5, 0.6, u) + Math.sin(u * Math.PI) * 2.6;
    }
    if (t < 0.2) {
      const u = t / 0.2;
      return lerp(1.75, 0.75, u) - Math.sin(u * Math.PI) * 0.12;
    }
    if (NO_CONTACT.includes(replay.kind)) return 0.7;
    if (t < 0.65) {
      const u = (t - 0.2) / 0.45;
      if (replay.fly) {
        const peak =
          replay.kind === 'homeRun'
            ? 24
            : replay.kind === 'triple' || replay.kind === 'double'
              ? 15
              : 10;
        const end = replay.kind === 'sacrifice' ? 1.6 : 0.1;
        return lerp(0.8, end, u) + Math.sin(u * Math.PI) * peak;
      }
      // Ground ball: decaying hops.
      return 0.1 + Math.abs(Math.sin(u * Math.PI * 3)) * 0.9 * (1 - u);
    }
    if (['homeRun', 'double', 'triple'].includes(replay.kind)) return 0.1;
    const u = clamp01((t - 0.65) / 0.25);
    return lerp(1.4, 1.3, u) + Math.sin(u * Math.PI) * 4;
  }

  private updateBall() {
    const replay = this.replay,
      t = this.progress;
    if (!replay || !replay.play || t > 0.94) {
      this.ball.visible = false;
      return;
    }
    const p = toWorld(ballPoint(replay, t));
    this.ball.visible = true;
    this.ball.position.set(p.x, this.ballHeight(t), p.z);
  }

  private updateCamera() {
    const cam = this.camera,
      t = this.progress,
      replay = this.replay;
    const portrait = cam.aspect < 1 ? 1.35 : 1;
    if (this.mode === 'overview' || !replay) {
      const a = -0.18 + t * 0.12;
      cam.position.set(Math.sin(a) * 60, 65, 32);
      this.lookTarget.set(0, 0, -24);
      cam.fov = 50 * portrait;
    } else {
      const stealOnly = replay.play?.plateAppearance === false;
      const noContact = NO_CONTACT.includes(replay.kind);
      const ballWorld = toWorld(ballPoint(replay, t));
      if (stealOnly) {
        // High-home camera looking at the target bag.
        const bag = toWorld(bases[replay.play?.steal?.to || 2]);
        cam.position.set(-4, 19, 24);
        this.lookTarget.lerpVectors(
          new THREE.Vector3(0, 1, -6),
          bag,
          smooth(clamp01((t - 0.1) / 0.3)),
        );
        cam.fov = 26 * portrait;
      } else if (t < 0.2 || noContact) {
        // Centre-field pitch camera.
        cam.position.set(2.6, 7.6, -68);
        this.lookTarget.set(0.3, 1.1, -2.5);
        cam.fov = 17 * portrait;
      } else {
        // High-home broadcast camera tracking the ball, then settling on the play.
        const side = replay.target.x >= HOME.x ? -1 : 1;
        cam.position.set(side * 6, 20, 24);
        const follow = smooth(clamp01((t - 0.2) / 0.12));
        const plate = new THREE.Vector3(0, 1, -4);
        const ballTarget = ballWorld.clone().setY(Math.min(this.ballHeight(t) * 0.6, 10));
        if (t > 0.9) {
          // Ease onto the decisive bag / fielder as the play settles.
          const settle = toWorld(replay.target).lerp(ballWorld, 0.5);
          this.lookTarget.lerpVectors(ballTarget, settle, clamp01((t - 0.9) / 0.1));
        } else this.lookTarget.lerpVectors(plate, ballTarget, follow);
        const dist = this.lookTarget.distanceTo(cam.position);
        cam.fov = THREE.MathUtils.clamp(3400 / dist, 22, 40) * portrait;
        if (replay.kind === 'homeRun' && t > 0.45) cam.fov = Math.max(cam.fov, 34 * portrait);
      }
    }
    cam.lookAt(this.lookTarget);
    cam.updateProjectionMatrix();
  }
}

export function createStadium(
  canvas: HTMLCanvasElement,
  options: { mobile: boolean; onLost: () => void; onRestored: () => void },
) {
  return new StadiumController(canvas, options);
}
