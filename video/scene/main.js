// Renders any moment of the explainer on demand: window.renderAt(seconds).
// Everything is a pure function of time, so frames can be rendered in any order, by any worker.
// Axes match the Python scripts: X = thickness, Y = across the block, Z = up. Units are mm.
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const W = 1920, H = 1080;
const AMBER = 0xffb224, CYAN = 0x5ad1ff, RED = 0xff6b4a, STEEL = 0xb8c0ca;
const WEDGE = 0x8e98a4, BASE = 0x4a525d, HEAD = 0x2f73c4;
const ASSETS = '/video/build/assets/';
const $ = (selector) => document.querySelector(selector);

// ---------------------------------------------------------------- helpers

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ss = (a, b, t) => { const x = clamp((t - a) / (b - a)); return x * x * (3 - 2 * x); };
const lerp = (a, b, x) => a + (b - a) * x;
const rad = THREE.MathUtils.degToRad;
const pulse = (a, b, t, edge = 0.3) => ss(a, a + edge, t) * (1 - ss(b - edge, b, t));
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const group = (...children) => { const g = new THREE.Group(); if (children.length) g.add(...children); return g; };
const glow = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity });

function show(selector, opacity) {
  const el = $(selector);
  el.style.opacity = opacity;
  el.style.visibility = opacity > 0.003 ? 'visible' : 'hidden';
}

// ---------------------------------------------------------------- renderer

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setSize(W, H);
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;
$('#gl').appendChild(renderer.domElement);

const world = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, W / H, 5, 6000);
camera.up.set(0, 0, 1);

const pmrem = new THREE.PMREMGenerator(renderer);
world.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
world.environmentIntensity = 0.5;

{
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 576;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(620, 240, 40, 512, 288, 760);
  r.addColorStop(0, '#1b2531'); r.addColorStop(0.55, '#10151d'); r.addColorStop(1, '#07090d');
  g.fillStyle = r; g.fillRect(0, 0, 1024, 576);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  world.background = texture;
}

const key = new THREE.DirectionalLight(0xfff4e6, 1.9);
key.position.set(-120, -260, 420);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -240, right: 240, top: 240, bottom: -240, near: 10, far: 1100 });
key.shadow.bias = -0.0006;
key.shadow.radius = 5;
const rimBlue = new THREE.DirectionalLight(0x6fb0ff, 1.8);
rimBlue.position.set(300, 320, 120);
const rimWarm = new THREE.DirectionalLight(0xffa860, 1.2);
rimWarm.position.set(-340, 200, 60);
const headlamp = new THREE.DirectionalLight(0xffffff, 0.75);
world.add(key, rimBlue, rimWarm, headlamp, headlamp.target);

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(world, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.3, 0.5, 1.15);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// A grid that fades with distance, plus a plane that catches shadows
const gridMaterial = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { center: { value: new THREE.Vector2() }, reach: { value: 420 }, strength: { value: 1 } },
  vertexShader: 'varying vec2 p; void main(){ p = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    varying vec2 p; uniform vec2 center; uniform float reach; uniform float strength;
    float grid(float size){ vec2 g = abs(fract(p / size - 0.5) - 0.5) / fwidth(p / size); return 1.0 - min(min(g.x, g.y), 1.0); }
    void main(){
      float fade = 1.0 - smoothstep(0.1, 1.0, length(p - center) / reach);
      float line = grid(10.0) * 0.32 + grid(50.0) * 0.75;
      gl_FragColor = vec4(vec3(0.42, 0.58, 0.78), line * fade * 0.42 * strength);
    }`,
});
const floor = group(
  new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), gridMaterial),
  new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.ShadowMaterial({ opacity: 0.55 })),
);
floor.children[1].receiveShadow = true;
floor.children[1].position.z = -0.02;
world.add(floor);

// ---------------------------------------------------------------- camera and callouts

// Each key: [time, az, el, dist, [target], shift]. Shift moves the subject right, as a fraction of the width.
function cam(t, keys, drift = 0) {
  let a = keys[0], b = keys[0], x = 0;
  if (t >= keys[keys.length - 1][0]) a = b = keys[keys.length - 1];
  else for (let i = 0; i + 1 < keys.length; i++) {
    if (t >= keys[i][0] && t < keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; x = ss(a[0], b[0], t); break; }
  }
  const az = rad(lerp(a[1], b[1], x) + drift * t), el = rad(lerp(a[2], b[2], x)), dist = lerp(a[3], b[3], x);
  const target = v3(...a[4]).lerp(v3(...b[4]), x);
  const shift = lerp(a[5] ?? 0, b[5] ?? 0, x);
  camera.setViewOffset(W, H, -shift * W, 0, W, H);
  camera.position.set(target.x + dist * Math.cos(el) * Math.cos(az), target.y + dist * Math.cos(el) * Math.sin(az), target.z + dist * Math.sin(el));
  camera.lookAt(target);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  headlamp.position.copy(camera.position);
  headlamp.target.position.copy(target);
  gridMaterial.uniforms.center.value.set(target.x, target.y);
}

const calloutHtml = [], calloutLines = [];
function callout(point, text, { dx = 0, dy = 0, op = 1, cls = 'amber', sub = '' } = {}) {
  if (op <= 0.003) return;
  const s = v3(point[0], point[1], point[2]).project(camera);
  const x = (s.x + 1) / 2 * W, y = (1 - s.y) / 2 * H;
  const color = { amber: '#ffb224', cyan: '#5ad1ff', red: '#ff6b4a', blue: '#5aa9ff' }[cls];
  if (dx || dy) {
    calloutLines.push(`<g opacity="${op}"><line x1="${x}" y1="${y}" x2="${x + dx}" y2="${y + dy}" stroke="${color}" stroke-width="2"/><circle cx="${x}" cy="${y}" r="5" fill="${color}"/></g>`);
  }
  calloutHtml.push(`<div class="co ${cls}" style="left:${x + dx}px;top:${y + dy}px;opacity:${op}">${text}${sub ? `<small>${sub}</small>` : ''}</div>`);
}
function flushCallouts() {
  $('#callouts svg').innerHTML = calloutLines.join('');
  $('#callouts').querySelectorAll('.co').forEach((el) => el.remove());
  $('#callouts').insertAdjacentHTML('beforeend', calloutHtml.join(''));
  calloutHtml.length = calloutLines.length = 0;
}

// ---------------------------------------------------------------- meshes

const loader = new STLLoader();
const geometries = {}, edgeGeometries = {};
async function load(name) {
  const raw = await loader.loadAsync(`${ASSETS}${name}.stl`);
  raw.computeVertexNormals();
  geometries[name] = toCreasedNormals(raw, rad(32));
  edgeGeometries[name] = new THREE.EdgesGeometry(raw, 30);
  return raw;
}

function part(name, color, edges = 0.2) {
  const material = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.52, metalness: 0.02, clearcoat: 0.18, clearcoatRoughness: 0.45,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });
  const mesh = new THREE.Mesh(geometries[name], material);
  mesh.castShadow = mesh.receiveShadow = true;
  const lines = new THREE.LineSegments(edgeGeometries[name], new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: edges }));
  const g = group(mesh, lines);
  let side = THREE.FrontSide;
  g.fade = (opacity, lineScale = 1) => {
    g.visible = opacity > 0.004;
    const glass = opacity < 0.999;
    material.opacity = opacity;
    material.transparent = glass;
    material.depthWrite = !glass;
    mesh.castShadow = opacity > 0.7;
    const wanted = glass ? THREE.DoubleSide : THREE.FrontSide;
    if (wanted !== side) { side = wanted; material.side = side; material.needsUpdate = true; }
    lines.material.opacity = edges * Math.min(1, opacity * 3) * lineScale;
  };
  return g;
}

// A plain stand-in, deliberately not a model of any real product. Local X points out of the camera face.
function standIn() {
  const body = new THREE.Mesh(new RoundedBoxGeometry(24, 50, 104, 6, 5),
    new THREE.MeshPhysicalMaterial({ color: 0x9fa6af, roughness: 0.42, clearcoat: 0.25 }));
  body.position.set(12, 0, 0);
  body.castShadow = true;
  const panel = new THREE.Mesh(new RoundedBoxGeometry(2, 40, 46, 4, 1),
    new THREE.MeshPhysicalMaterial({ color: 0x0c0f14, roughness: 0.12, clearcoat: 1 }));
  panel.position.set(24, 0, 23);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 2, 48), new THREE.MeshPhysicalMaterial({ color: 0x1a2a44, roughness: 0.05, metalness: 0.5, clearcoat: 1 }));
  lens.rotation.z = Math.PI / 2;
  lens.position.set(25, 0, 26);
  const button = new THREE.Mesh(new THREE.TorusGeometry(8, 1, 12, 48), glow(0x4fb7ff));
  button.rotation.y = Math.PI / 2;
  button.position.set(24.4, 0, -28);
  return group(body, panel, lens, button);
}

// A flat, translucent fan showing where the camera points, along local +X from the lens
function viewFan(length = 240, halfDeg = 34) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(length * Math.cos(rad(halfDeg)), length * Math.sin(rad(halfDeg)));
  shape.absarc(0, 0, length, rad(halfDeg), rad(-halfDeg), true);
  shape.lineTo(0, 0);
  const material = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
  const fan = new THREE.Mesh(new THREE.ShapeGeometry(shape, 32), material);
  const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, length, 8), glow(CYAN));
  axis.rotation.z = -Math.PI / 2;
  axis.position.x = length / 2;
  return group(fan, axis);
}

// Fixed wedge geometry, from the same formulas as build() in ring_camera_wedge.py
function wedgeFrame(F, angle) {
  const a = rad(angle);
  const along = [Math.sin(a), Math.cos(a)], normal = [Math.cos(a), -Math.sin(a)];
  const thin = F.THICK_SIDE - F.FACE_WIDTH * Math.sin(a);
  return {
    along, normal, thin, yExtent: F.FACE_WIDTH * Math.cos(a),
    onFace: (s) => [thin + along[0] * s, along[1] * s],
    orient(object, s, z, out = 0) {
      const p = this.onFace(s);
      object.position.set(p[0] + normal[0] * out, p[1] + normal[1] * out, z);
      object.rotation.set(0, 0, -a);
    },
  };
}

function tube(points, radius, color, closed = false) {
  const curve = new THREE.CurvePath();
  for (let i = 0; i + 1 < points.length; i++) curve.add(new THREE.LineCurve3(points[i], points[i + 1]));
  if (closed) curve.add(new THREE.LineCurve3(points[points.length - 1], points[0]));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 240, radius, 8, false), glow(new THREE.Color(color).multiplyScalar(1.7)));
}

function roundedLoop(halfU, halfV, r, count = 24) {
  const out = [];
  [[1, 1, 0], [-1, 1, 1], [-1, -1, 2], [1, -1, 3]].forEach(([su, sv, q]) => {
    for (let i = 0; i <= count; i++) {
      const a = (i / count + q) * Math.PI / 2;
      out.push(v3(su * (halfU - r) + r * Math.cos(a), sv * (halfV - r) + r * Math.sin(a), 0));
    }
  });
  return out;
}

// ---------------------------------------------------------------- source code panels

function highlight(text, inDoc) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  if (inDoc) return `<span class="t-c">${esc(text)}</span>`;
  const pattern = /(#.*$)|("""|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(def|return|for|in|if|not|import|from|as|else|or|and|True|False|None|lambda)\b|\b(\d+\.?\d*)\b|\b([A-Z][A-Z_0-9]{2,})\b|(?<=def )(\w+)/g;
  let out = '', last = 0, m;
  while ((m = pattern.exec(text))) {
    out += esc(text.slice(last, m.index));
    const cls = m[1] ? 't-c' : m[2] ? 't-s' : m[3] ? 't-k' : m[4] ? 't-n' : m[5] ? 't-C' : 't-d';
    out += `<span class="${cls}">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + esc(text.slice(last));
}

function codePanel(element, source) {
  const lines = source.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  let inDoc = false;
  element.innerHTML = lines.map((line, i) => {
    const toggles = (line.match(/"""/g) || []).length;
    const html = highlight(line, inDoc || toggles === 1);
    if (toggles === 1) inDoc = !inDoc;
    return `<div class="ln"><i>${i + 1}</i>${html || ' '}</div>`;
  }).join('');
  const rows = [...element.children];
  let lit = [];
  return {
    count: lines.length,
    find: (text) => lines.findIndex((l) => l.includes(text)) + 1,
    // Keeps the given 1-based line at the given row of the view
    set(line, highlighted = []) {
      element.style.transform = `translateY(${-(line - 1) * 31}px)`;
      lit.forEach((n) => rows[n - 1].classList.remove('hl'));
      highlighted.forEach((n) => rows[n - 1].classList.add('hl'));
      lit = highlighted;
    },
  };
}

// ---------------------------------------------------------------- scenes

const scenes = {};

function sceneTitle(S) {
  const wedge = part('final', WEDGE);
  const g = group(wedge);
  world.add(g);
  S.group = g;
  S.update = (t) => {
    wedge.fade(1);
    cam(t, [[0, -62, 12, 520, [23, 27, 55], 0.2], [4.6, -20, 20, 430, [23, 27, 55], 0.2]]);
    bloom.strength = 0.42;
    show('#ov-title', ss(0.7, 1.7, t));
    gridMaterial.uniforms.strength.value = ss(0, 2, t);
  };
}

function sceneSketch(S, F, inkedScan) {
  // Paper positioned so that the plan view on it lines up with the model's own X and Y.
  // Coordinates below are in pixels of the scan at 1454 wide, where it measures 6.7 px/mm.
  const PX = 6.7, ORIGIN = [275, 1395];
  const toWorld = (px, py) => [(px - ORIGIN[0]) / PX, (ORIGIN[1] - py) / PX];
  const texture = new THREE.CanvasTexture(inkedScan);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  const [cx, cy] = toWorld(727, 1000);
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(1454 / PX, 2000 / PX), new THREE.MeshBasicMaterial({ map: texture, color: new THREE.Color(1.5, 1.47, 1.38) }));
  paper.position.set(cx, cy, 0.05);
  paper.receiveShadow = true;
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(1454 / PX, 2000 / PX), new THREE.ShadowMaterial({ opacity: 0.5 }));
  catcher.position.set(cx, cy, 0.12);
  catcher.receiveShadow = true;

  const frame = ([x0, y0, x1, y1], color) => {
    const [a, b] = toWorld(x0, y0), [c, d] = toWorld(x1, y1);
    const w = c - a, h = b - d, cxx = (a + c) / 2, cyy = (b + d) / 2, s = 0.45;
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.26, depthWrite: false }));
    fill.position.set(cxx, cyy, 0.2);
    const edge = new THREE.Mesh(new THREE.BufferGeometry(), fill.material.clone());
    const pieces = [[cxx, b, w + s, s], [cxx, d, w + s, s], [a, cyy, s, h], [c, cyy, s, h]].map(([x, y, pw, ph]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), edge.material);
      m.position.set(x, y, 0.22);
      return m;
    });
    const marker = group(fill, ...pieces);
    marker.setOp = (op) => {
      marker.visible = op > 0.004;
      fill.material.opacity = 0.26 * op;
      edge.material.opacity = op;
      edge.material.transparent = true;
    };
    return marker;
  };
  const written = [[1278, 415, 1368, 440], [1008, 848, 1102, 875], [988, 276, 1092, 300], [708, 518, 786, 545], [798, 670, 866, 697], [1094, 98, 1214, 124], [1058, 514, 1104, 534]].map((r) => frame(r, AMBER));
  const unknown = [[648, 282, 772, 314], [524, 1458, 578, 1508]].map((r) => frame(r, RED));

  const f = wedgeFrame(F, F.ANGLE_DEG);
  const outlinePoints = [v3(0, 0, 0.3), v3(f.thin, 0, 0.3), v3(F.THICK_SIDE, f.yExtent, 0.3), v3(0, f.yExtent, 0.3), v3(0, 0, 0.3)];
  const outline = tube(outlinePoints, 0.65, AMBER);
  const outlineCount = outline.geometry.index.count;

  const block = part('stage_0', WEDGE);
  const blockPivot = group(block);
  const g = group(paper, catcher, ...written, ...unknown, outline, blockPivot);
  world.add(g);
  S.group = g;

  const page = [cx, cy, 0];
  const qAngle = [...toWorld(551, 1483), 0], qDepth = [...toWorld(710, 298), 0], plan = [23, 27, 0];
  S.update = (t) => {
    const [L0, L1, L2, L3] = S.lines.map((l) => l.start);
    const [, E1, E2] = S.lines.map((l) => l.end);
    bloom.strength = 0;
    floor.visible = true;
    gridMaterial.uniforms.strength.value = 0.5;
    floor.position.z = -0.4;
    cam(t, [
      [S.start, -90, 88, 880, page], [L1, -90, 88, 690, page],
      [L2, -90, 88, 690, page], [L2 + 1.2, -90, 80, 300, qAngle],
      [L2 + 4.5, -90, 80, 300, qAngle], [L2 + 5.5, -90, 80, 300, qDepth],
      [L3 - 0.2, -90, 80, 300, qDepth], [L3 + 1.2, -90, 86, 360, plan],
      [L3 + 2.2, -90, 86, 360, plan], [S.end - 0.6, -52, 24, 470, [23, 27, 50]],
    ]);
    written.forEach((m, i) => m.setOp(pulse(L1 + 0.15 * i, L2 + 0.4, t)));
    const urgent = 0.75 + 0.25 * Math.sin(t * 7);
    unknown.forEach((m) => m.setOp(ss(L1 + 3.2, L1 + 3.6, t) * (1 - ss(L3, L3 + 0.4, t)) * urgent));

    callout(qAngle, 'marked "?°"', { dx: 240, dy: -40, op: pulse(L2 + 0.9, L2 + 4.6, t), cls: 'red', sub: 'used: 8°, estimated from the drawing' });
    callout(qDepth, 'marked "Depth ?"', { dx: 280, dy: 90, op: pulse(L2 + 5.2, L3 + 0.2, t), cls: 'red', sub: 'used: about 11–15 mm, estimated' });

    outline.visible = t > L3;
    outline.geometry.setDrawRange(0, Math.floor(outlineCount * ss(L3 + 0.1, L3 + 1.4, t)));
    const rise = ss(L3 + 1.5, L3 + 3.3, t);
    block.visible = rise > 0.001;
    blockPivot.scale.z = Math.max(0.001, rise);
    block.fade(1);
    block.visible = rise > 0.001;
    callout([F.THICK_SIDE, f.yExtent, 0], 'footprint, traced from the page', { dx: 300, dy: 80, op: pulse(L3 + 1.2, S.end - 0.5, t) });
    void E1;
  };
}

function sceneCode(S, F, source) {
  const block = part('stage_0', WEDGE);
  const f = wedgeFrame(F, F.ANGLE_DEG);
  const P = (x, y, z) => v3(x, y, z);
  const offset = 7;
  const dims = [
    tube([P(-offset, f.yExtent, 0), P(-offset, f.yExtent, F.HEIGHT)], 0.4, AMBER),
    tube([P(f.thin + 3, -3, F.HEIGHT + 3), P(F.THICK_SIDE + 3, f.yExtent - 3, F.HEIGHT + 3)], 0.4, AMBER),
  ];
  const g = group(block, ...dims);
  world.add(g);
  S.group = g;
  const panel = codePanel($('#code-inner'), source);
  $('#code-lines .v').textContent = panel.count;
  const line = (text) => panel.find(text);
  const constants = ['HEIGHT = ', 'FACE_WIDTH = ', 'ANGLE_DEG = ', 'THICK_SIDE = '].map(line);
  const blockLine = line('block = prism(');
  S.update = (t) => {
    const [L0, L1, L2] = S.lines.map((l) => l.start);
    block.fade(1);
    bloom.strength = 0.3;
    cam(t, [[S.start, -38, 20, 460, [23, 27, 52], 0.25], [L2, -55, 18, 450, [23, 27, 52], 0.25], [S.end, -40, 16, 430, [23, 27, 52], 0.25]]);
    show('#ov-code', ss(S.start + 0.1, S.start + 0.6, t));
    show('#code-lines', 1 - ss(L1 - 0.2, L1 + 0.2, t));
    const gap = (S.lines[1].end - L1) / 4.2;
    const step = (t - L1) / gap;
    const active = t < L1 ? -1 : t < L2 ? Math.min(3, Math.floor(step)) : -1;
    const top = t < L2 ? lerp(1, 13, ss(L0 + 0.5, L1, t)) : lerp(13, blockLine - 8, ss(L2, L2 + 1.2, t));
    panel.set(Math.round(top * 31) / 31, active >= 0 ? [constants[active]] : t >= L2 + 0.8 ? [blockLine] : []);
    dims[0].visible = active === 0;
    dims[1].visible = active === 1;
    callout([-offset, f.yExtent, F.HEIGHT / 2], 'HEIGHT = 110 mm', { op: active === 0 ? 1 : 0, dx: -10, dy: -40 });
    callout([f.thin + 12, f.yExtent / 2, F.HEIGHT + 3], 'FACE_WIDTH = 55 mm', { op: active === 1 ? 1 : 0, dy: -60 });
    callout([f.onFace(30)[0], f.onFace(30)[1], F.HEIGHT], 'ANGLE_DEG = 8°', { op: active === 2 ? 1 : 0, dx: 120, dy: -80, sub: 'an estimate: marked "?" on the sketch' });
    callout([F.THICK_SIDE, f.yExtent, F.HEIGHT], 'THICK_SIDE = 46 mm', { op: active === 3 ? 1 : 0, dx: 100, dy: -60, sub: 'scaled from the drawing' });
    callout([f.thin, 0, F.HEIGHT], 'one solid block', { op: ss(L2 + 0.8, L2 + 1.2, t), dx: 150, dy: -90 });
  };
}

function sceneCarve(S, F, facts) {
  const stages = [0, 1, 2, 3, 4, 5].map((i) => part(`stage_${i}`, WEDGE));
  stages.push(part('final', WEDGE));
  const cutterMaterial = new THREE.MeshPhysicalMaterial({ color: AMBER, emissive: 0xff8a00, emissiveIntensity: 0.65, roughness: 0.4, transparent: true });
  const cutters = [1, 2, 3, 4, 5, 6].map((i) => { const m = new THREE.Mesh(geometries[`cutter_${i}`], cutterMaterial); return m; });
  const g = group(...stages, ...cutters);
  world.add(g);
  S.group = g;
  const panel = codePanel($('#carve-inner'), facts.repo.source['ring_camera_wedge.py']);
  const normal = [Math.cos(rad(8)), -Math.sin(rad(8)), 0];
  const approach = [normal, normal, [0, 0, -1], [-1, 0, 0], normal, [0, -1, 0]];
  const views = [[-22, 16, 430], [-30, 24, 390], [-40, -46, 430], [158, 16, 430], [-18, 8, 440], [-90, 14, 440]];
  const target = [23, 27, 55];
  S.update = (t) => {
    bloom.strength = 0.48;
    const starts = S.lines.map((l) => l.start);
    let stage = 0;
    for (let i = 0; i < 6; i++) if (t >= starts[i] + 0.9) stage = i + 1;
    const finished = t >= starts[5] + 0.9;
    stages.forEach((m, i) => { m.visible = false; });
    const shown = finished ? stages[6] : stages[stage];
    shown.visible = true;
    shown.fade(1);
    cutters.forEach((c, i) => {
      const s = starts[i];
      const inP = ss(s, s + 0.9, t), out = ss(s + 0.95, s + 1.5, t);
      c.visible = t > s && out < 1;
      c.position.set(...approach[i].map((n) => n * 70 * (1 - inP)));
    });
    cutterMaterial.opacity = 1;
    const active = cutters.findIndex((c) => c.visible);
    if (active >= 0) cutterMaterial.opacity = 1 - ss(starts[active] + 0.95, starts[active] + 1.5, t);

    const keys = [[S.start, -40, 16, 430, target, 0.25]];
    views.forEach((v, i) => {
      keys.push([starts[i] - 0.1, v[0], v[1], v[2], target, 0.25]);
      keys.push([(S.lines[i].end + (starts[i + 1] ?? S.end)) / 2 - 0.25, v[0], v[1], v[2], target, 0.25]);
    });
    keys.push([starts[6] + 0.9, -55, 18, 440, target, 0.25], [S.end, -18, 18, 420, target, 0.25]);
    floor.visible = camera.position.z > 8;
    cam(t, keys);
    floor.visible = camera.position.z > 8;

    show('#ov-carve', ss(S.start, S.start + 0.3, t));
    const current = Math.min(5, starts.filter((s) => t >= s).length - 1);
    const info = facts.stages[Math.max(0, current)];
    panel.set(Math.max(1, info.line - 12), t >= starts[6] ? [] : [info.line]);
    $('#carve-card .n').textContent = t >= starts[6] ? '6 of 6' : `${current + 1} of 6`;
    $('#carve-card .t').textContent = t >= starts[6] ? 'Finished part' : info.label;
    const tris = finished ? facts.stl.triangles : stage === 0 ? 12 : facts.stages[stage - 1].faces;
    $('#carve-tris .v').textContent = tris.toLocaleString('en-US');
    if (t >= starts[6]) panel.set(180 - 12, [180]);
  };
}

function sceneAngle(S, F, facts) {
  const meshes = facts.sweep.map((s) => part(`angle_${s.angle}`, WEDGE));
  const cameraBody = standIn();
  const fan = viewFan();
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(190, 150), new THREE.MeshBasicMaterial({ color: 0x8aa0b8, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }));
  wall.rotation.x = Math.PI / 2;
  wall.position.set(50, 0.05, 60);
  const wallEdge = new THREE.LineSegments(new THREE.EdgesGeometry(wall.geometry), new THREE.LineBasicMaterial({ color: 0x8aa0b8, transparent: true, opacity: 0.5 }));
  wallEdge.rotation.copy(wall.rotation); wallEdge.position.copy(wall.position);
  const pivot = group(...meshes, cameraBody, fan);
  const g = group(pivot, wall, wallEdge);
  world.add(g);
  S.group = g;
  const type = (text, a, b, t) => text.slice(0, Math.floor(text.length * clamp((t - a) / (b - a))));
  const prompt = (a) => `python ring_camera_wedge.py --angle ${a} --output ring_camera_wedge_${a}deg.stl`;
  S.update = (t) => {
    const [L0, L1, L2] = S.lines.map((l) => l.start);
    const E2 = S.lines[2].end;
    bloom.strength = 0.3;
    gridMaterial.uniforms.strength.value = 0.7;
    // The command for 12 runs first, then 20; each result appears when its command finishes
    const run12 = L1 + 1.5, run20 = L1 + 3.7;
    let a = 8;
    if (t >= run12) a = 12;
    if (t >= run20) a = 20;
    if (t >= L2) {
      const x = clamp((t - L2) / (E2 + 0.4 - L2));
      // 20 down to 0, back up to 8
      a = Math.round(x < 0.6 ? lerp(20, 0, ss(0, 0.6, x)) : lerp(0, 8, ss(0.6, 1, x)));
    }
    meshes.forEach((m, i) => { m.visible = i === a; if (i === a) m.fade(1); });
    const f = wedgeFrame(F, a);
    pivot.position.y = -f.yExtent;
    f.orient(cameraBody, F.FACE_WIDTH / 2, F.HEIGHT / 2);
    f.orient(fan, F.FACE_WIDTH / 2, F.HEIGHT / 2 + 26, 24);
    cam(t, [[S.start, -74, 46, 520, [40, -30, 50], 0.2], [L2, -80, 54, 520, [40, -30, 50], 0.2], [S.end, -84, 60, 540, [40, -30, 50], 0.2]]);
    show('#ov-angle', ss(S.start, S.start + 0.4, t));

    const line = (angle) => facts.sweep[angle];
    let html = `<span class="p">$</span> ${type(prompt(12), L1 - 0.4, run12 - 0.1, t)}`;
    if (t < L1 - 0.4) {
      html = `<span class="p">$</span> ${type(prompt(8), L0 + 0.1, L0 + 1.1, t)}`;
      if (t > L0 + 1.3) html += `\n<span class="o">${line(8).output}</span>`;
    } else if (t < run20 - 1.2) {
      if (t >= run12) html += `\n<span class="o">${line(12).output}</span>`;
    } else if (t < L2) {
      html = `<span class="p">$</span> ${type(prompt(20), run20 - 1.2, run20 - 0.1, t)}`;
      if (t >= run20) html += `\n<span class="o">${line(20).output}</span>`;
    } else {
      html = `<span class="p">$</span> for angle in 0..20: python ring_camera_wedge.py --angle $angle\n<span class="o">${line(a).output}</span>`;
    }
    $('#term').innerHTML = html + '<i class="cursor"></i>';
    $('#angle-big').textContent = `${a}°`;
    const times = facts.sweep.map((s) => s.seconds);
    const worst = Math.max(...times);
    $('#angle-note').innerHTML = `Measured run time, startup included: <b>${worst.toFixed(2)} s</b> at worst across all 21 runs.`;
    callout([46, -f.yExtent + f.yExtent, 110], 'mounting surface', { dx: 150, dy: -40, cls: 'blue', op: 0.95 });
    callout([f.thin + 90 * f.normal[0], -f.yExtent + 27 + 90 * f.normal[1], 81], "camera's view", { cls: 'cyan', dx: 40, dy: 110, op: 0.95 });
    callout([f.thin - 8, -f.yExtent + 27, 110], 'stand-in camera', { dx: 90, dy: -70, cls: 'amber', op: pulse(L0, L1, t) });
  };
}

function sceneStl(S, F, facts, raw) {
  const solid = part('final', WEDGE);
  const wire = new THREE.LineSegments(new THREE.WireframeGeometry(raw), new THREE.LineBasicMaterial({ color: CYAN, transparent: true }));
  // Shards: the file's own triangles, free to move apart
  const source = raw.attributes.position.array;
  const count = source.length / 9;
  const positions = new Float32Array(source.length);
  const shardGeo = new THREE.BufferGeometry();
  shardGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  shardGeo.setAttribute('normal', raw.attributes.normal);
  const shards = new THREE.Mesh(shardGeo, new THREE.MeshStandardMaterial({ color: 0x8fd6ff, side: THREE.DoubleSide, roughness: 0.4, emissive: 0x114466, flatShading: false }));
  const centroids = new Float32Array(count * 3), bursts = new Float32Array(count * 3);
  const centre = v3(23, 27, 55);
  for (let i = 0; i < count; i++) {
    const j = i * 9;
    const cx = (source[j] + source[j + 3] + source[j + 6]) / 3, cy = (source[j + 1] + source[j + 4] + source[j + 7]) / 3, cz = (source[j + 2] + source[j + 5] + source[j + 8]) / 3;
    centroids.set([cx, cy, cz], i * 3);
    const d = v3(cx, cy, cz).sub(centre).normalize().multiplyScalar(70 + 190 * hash(i));
    d.z += (hash(i + 9000) - 0.5) * 90;
    bursts.set([d.x, d.y, d.z], i * 3);
  }
  const first = facts.stl.first_triangles[0].vertices;
  const firstGeo = new THREE.BufferGeometry();
  firstGeo.setAttribute('position', new THREE.Float32BufferAttribute(first.flat().map((x, i) => (i % 3 === 1 ? x - 0.25 : x)), 3));
  const firstTri = new THREE.Mesh(firstGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(AMBER).multiplyScalar(1.4), side: THREE.DoubleSide, transparent: true }));
  const firstEdge = tube([v3(...first[0]).setY(-0.3), v3(...first[1]).setY(-0.3), v3(...first[2]).setY(-0.3), v3(...first[0]).setY(-0.3)], 0.3, AMBER);
  const g = group(solid, wire, shards, firstTri, firstEdge);
  world.add(g);
  S.group = g;

  // Real bytes from offset 80: the count, then the first triangles
  const hex = facts.stl.first_bytes.match(/../g);
  const fields = [
    { key: 'count', size: 4, color: '#c58cff', label: 'count' },
    { key: 'normal', size: 12, color: '#5ad1ff', label: 'direction' },
    { key: 'v1', size: 12, color: '#ffb224', label: 'corner 1' },
    { key: 'v2', size: 12, color: '#ff8f5a', label: 'corner 2' },
    { key: 'v3', size: 12, color: '#ff6b8a', label: 'corner 3' },
    { key: 'attr', size: 2, color: '#58d68d', label: 'spare' },
  ];
  const owner = [];
  fields.forEach((f, i) => { for (let n = 0; n < f.size; n++) owner.push(i); });
  const rows = [];
  for (let i = 0; i < 16 * 8; i += 16) {
    const offset = (80 + i).toString(16).padStart(8, '0');
    const cells = hex.slice(i, i + 16).map((b, n) => `<span class="b" data-i="${i + n}">${b}</span>`).join(' ');
    rows.push(`<div class="row"><em>${offset}</em>  ${cells}</div>`);
  }
  $('#hex-rows').innerHTML = rows.join('');
  const allZero = /^0+$/.test(facts.stl.header);
  $('#hex-note').textContent = `Binary STL. The first 80 bytes are a header${allZero ? ', all zeros here' : ''}; then a 4-byte count; then 50 bytes per triangle. The second triangle starts right after these fields.`;
  const fmt = (v) => v.map((x) => x.toFixed(3).replace(/\.?0+$/, '') || '0').join(', ');
  const T = facts.stl.first_triangles[0];
  const values = [facts.stl.triangles.toLocaleString('en-US') + ' triangles', `(${fmt(T.normal)})`, `(${fmt(T.vertices[0])}) mm`, `(${fmt(T.vertices[1])}) mm`, `(${fmt(T.vertices[2])}) mm`, 'unused'];
  $('#hex-fields').innerHTML = fields.map((f, i) => `<div data-f="${i}"><u style="background:${f.color}"></u><b style="color:${f.color}">${f.label}</b><span>${values[i]}</span></div>`).join('');
  const cells = [...document.querySelectorAll('#hex-rows .b')];
  const fieldRows = [...document.querySelectorAll('#hex-fields div')];

  S.update = (t) => {
    const [L0, L1, L2, L3] = S.lines.map((l) => l.start);
    const E2 = S.lines[2].end;
    bloom.strength = 0.42;
    gridMaterial.uniforms.strength.value = 0.45;
    const toWire = ss(L0 + 0.5, L0 + 2.2, t);
    const burst = t < L1 ? 0 : ss(L1 + 0.1, L1 + 1.7, t) * (1 - ss(L2 - 1.3, L2 + 0.1, t));
    const backToSolid = ss(L2 + 0.1, L2 + 1, t);
    solid.fade(burst > 0.002 ? 0 : Math.max(1 - toWire, backToSolid), 1);
    wire.visible = burst <= 0.002 && toWire > 0.01 && backToSolid < 0.99;
    wire.material.opacity = toWire * (1 - backToSolid) * 0.85;
    shards.visible = burst > 0.002;
    if (shards.visible) {
      for (let i = 0; i < count; i++) {
        const k = burst * (0.55 + 0.45 * hash(i * 3 + 1));
        const j = i * 9, c = i * 3;
        for (let n = 0; n < 3; n++) {
          for (let d = 0; d < 3; d++) {
            const p = source[j + n * 3 + d];
            positions[j + n * 3 + d] = centroids[c + d] + (p - centroids[c + d]) * (1 - 0.25 * k) + bursts[c + d] * k;
          }
        }
      }
      shardGeo.attributes.position.needsUpdate = true;
    }
    const triOp = pulse(L2 + 0.7, S.end + 1, t);
    firstTri.visible = firstEdge.visible = triOp > 0.01;
    firstTri.material.opacity = triOp * (0.75 + 0.25 * Math.sin(t * 4));
    cam(t, [
      [S.start, -40, 18, 430, [23, 27, 55], 0.14], [L1, -60, 16, 430, [23, 27, 55], 0.14],
      [L2 - 0.4, -110, 20, 660, [23, 27, 55], 0.2], [L2 + 1.1, -98, 8, 300, [18, 0, 36], 0.25],
      [L3, -92, 6, 290, [18, 0, 36], 0.25], [S.end, -78, 10, 400, [23, 27, 55], 0.25],
    ]);
    show('#ov-stl', ss(S.start, S.start + 0.3, t));
    show('#hex-panel', ss(L2 - 0.1, L2 + 0.5, t));
    const countOp = ss(L1, L1 + 0.3, t) * (1 - ss(L2 - 0.2, L2 + 0.3, t));
    show('#stl-count', countOp);
    $('#stl-count .v').textContent = Math.round(facts.stl.triangles * ss(L1, L1 + 1.9, t)).toLocaleString('en-US');
    show('#stl-readers', ss(L3, L3 + 0.4, t));
    // Fields light up in order as the sentence names them
    const span = E2 - L2;
    const active = t < L2 ? -1 : Math.min(5, Math.floor(clamp((t - L2 - 0.5) / (span * 0.55)) * 6));
    cells.forEach((cell) => {
      const i = +cell.dataset.i;
      const f = owner[i];
      const on = f !== undefined && f <= active;
      cell.classList.toggle('on', on);
      cell.style.background = on ? fields[f].color : 'transparent';
    });
    fieldRows.forEach((row, i) => row.classList.toggle('on', i <= active));
    callout(first[1], 'triangle 1, from those bytes', { dx: 170, dy: -110, op: triOp });
  };
}

function sceneWeather(S, F, facts) {
  const glass = part('final', 0x9fc2e0, 0.5);
  const f = wedgeFrame(F, F.ANGLE_DEG);
  const seal = new THREE.MeshPhysicalMaterial({ color: 0xff5a2a, emissive: 0xff3a10, emissiveIntensity: 0.55, roughness: 0.5 });
  const pocketZ = (F.POCKET_Z[0] + F.POCKET_Z[1]) / 2;
  const loop = roundedLoop(F.POCKET_WIDTH / 2 + F.POCKET_SEAL_MARGIN, (F.POCKET_Z[1] - F.POCKET_Z[0]) / 2 + F.POCKET_SEAL_MARGIN, F.POCKET_SEAL_CORNER_R);
  const curve = new THREE.CatmullRomCurve3(loop, true, 'catmullrom', 0.2);
  const cord = new THREE.Mesh(new THREE.TubeGeometry(curve, 320, 1, 10, true), seal);
  // The loop is drawn in its own XY plane; stand it on the camera face
  const gasket = group(cord);
  gasket.setRotationFromMatrix(new THREE.Matrix4().makeBasis(v3(0, 1, 0), v3(0, 0, 1), v3(1, 0, 0)));
  const gasketHolder = group(gasket);
  const ringFor = (radius) => new THREE.Mesh(new THREE.TorusGeometry(radius, 1, 12, 96), seal);
  const yCable = f.onFace(F.FACE_WIDTH / 2 + F.CABLE_OFFSET)[1];
  const cableRing = ringFor(F.CABLE_SEAL_R);
  cableRing.rotation.y = Math.PI / 2;
  const screwRings = [(F.HEIGHT - F.SCREW_SPACING) / 2, (F.HEIGHT + F.SCREW_SPACING) / 2].map((z) => {
    const ring = ringFor(F.SCREW_SEAL_R);
    ring.rotation.x = Math.PI / 2;
    ring.userData.home = [F.SCREW_X, f.yExtent - 0.6, z];
    return ring;
  });

  const faceCentre = f.onFace(F.FACE_WIDTH / 2);
  const rise = Math.tan(rad(F.CABLE_RISE_DEG));
  const weepFace = f.onFace(F.FACE_WIDTH / 2 - F.WEEP_OFFSET);
  const weep = [weepFace[0] - f.normal[0] * F.WEEP_BEHIND_FACE, weepFace[1] - f.normal[1] * F.WEEP_BEHIND_FACE];

  // Rain falls around the block, not through it
  const RAIN = 520;
  const rainPositions = new Float32Array(RAIN * 6);
  const rain = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.45 }));
  rain.geometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  rain.frustumCulled = false;

  const DROPS = 18;
  const drop = new THREE.InstancedMesh(new THREE.SphereGeometry(1.15, 14, 10), glow(new THREE.Color(0x7fe0ff).multiplyScalar(1.5)), DROPS);
  drop.frustumCulled = false;
  const dummy = new THREE.Object3D();

  const lifted = group(glass, gasketHolder, cableRing, ...screwRings, drop);
  lifted.position.z = 34;
  const g = group(lifted, rain);
  world.add(g);
  S.group = g;

  S.update = (t) => {
    const [L0, L1, L2, L3] = S.lines.map((l) => l.start);
    bloom.strength = 0.5;
    gridMaterial.uniforms.strength.value = 0.45;
    glass.fade(lerp(1, 0.13, ss(L0, L0 + 1.5, t)), 1.2);
    cam(t, [
      [S.start, -30, 16, 440, [23, 27, 80]], [L1, -38, 18, 400, [23, 27, 80]],
      [L1 + 3.5, 160, 20, 400, [23, 27, 80]], [L2, 200, 12, 360, [18, 27, 62]],
      [L3, 225, 8, 360, [18, 27, 58]], [S.end, 290, 12, 420, [23, 27, 72]],
    ]);

    // Seals fly in one group at a time
    const inP = ss(L1 + 0.1, L1 + 1.3, t), inQ = ss(L1 + 1.4, L1 + 2.6, t);
    const faceOut = 70 * (1 - inP);
    gasketHolder.visible = inP > 0.001;
    gasketHolder.position.set(faceCentre[0] + f.normal[0] * (faceOut - 0.6), faceCentre[1] + f.normal[1] * (faceOut - 0.6), pocketZ);
    gasketHolder.rotation.set(0, 0, -rad(F.ANGLE_DEG));
    cableRing.visible = inQ > 0.001;
    cableRing.position.set(0.6 - 70 * (1 - inQ), yCable, F.CABLE_Z);
    screwRings.forEach((ring) => {
      const [x, y, z] = ring.userData.home;
      ring.visible = inQ > 0.001;
      ring.position.set(x, y + 70 * (1 - inQ), z);
    });

    // Water paths, using the model's own coordinates
    const cableIn = [F.POCKET_BACK_X, yCable, F.CABLE_Z + rise * F.POCKET_BACK_X], cableOut = [0, yCable, F.CABLE_Z];
    const waterOn = ss(L2 - 0.3, L2 + 0.4, t);
    for (let i = 0; i < DROPS; i++) {
      dummy.position.set(0, 0, -999);
      dummy.scale.setScalar(0.001);
      if (waterOn > 0 && t < S.end) {
        const speed = 0.28;
        const x = (t * speed + (i >> 1) * 2 / DROPS + hash(i) * 0.04) % 1;
        if (i % 2 === 0) {
          // Down through the weep hole, then a falling drip
          const z = x < 0.55 ? lerp(F.POCKET_Z[0] + 1, 0, x / 0.55) : -60 * Math.pow((x - 0.55) / 0.45, 2) * 0.57;
          dummy.position.set(weep[0], weep[1], z);
        } else {
          // Back down the cable hole's slope, then off the back face
          if (x < 0.6) {
            const u = x / 0.6;
            dummy.position.set(lerp(cableIn[0], cableOut[0], u), yCable, lerp(cableIn[2], cableOut[2], u) - 3);
          } else {
            const u = (x - 0.6) / 0.4;
            dummy.position.set(-1 - u * 2.5, yCable, cableOut[2] - 3 - 66 * u * u);
          }
        }
        dummy.position.z = Math.max(dummy.position.z, -33);
        dummy.scale.setScalar(waterOn);
      }
      dummy.updateMatrix();
      drop.setMatrixAt(i, dummy.matrix);
    }
    drop.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < RAIN; i++) {
      let x = hash(i) * 420 - 190, y = hash(i + 2000) * 420 - 190;
      if (x > -6 && x < 52 && y > -6 && y < 60) x += 80;
      const z = 260 - ((hash(i + 4000) * 260 + t * (330 + 80 * hash(i + 6000))) % 260);
      rainPositions.set([x, y, z, x, y, z + 9], i * 6);
    }
    rain.geometry.attributes.position.needsUpdate = true;
    rain.material.opacity = 0.45 * (1 - ss(L3 - 0.2, L3 + 0.6, t) * 0.6);

    const z = lifted.position.z;
    callout([faceCentre[0], faceCentre[1], pocketZ + z + 18.5], 'gasket', { dx: 150, dy: -90, op: pulse(L1 + 0.9, L2 - 0.1, t), cls: 'red', sub: 'in a groove around the pocket' });
    callout([0, yCable, F.CABLE_Z + z + 10], 'O-ring', { dx: -130, dy: -90, op: pulse(L1 + 2.4, L2 + 0.4, t), cls: 'red', sub: 'cable hole' });
    callout([cableIn[0] * 0.5, yCable, F.CABLE_Z + z], 'hole rises 5° towards the pocket', { dx: 60, dy: -150, op: pulse(L2 + 0.1, L3, t), cls: 'cyan' });
    callout([weep[0], weep[1], 6 + z], 'weep hole, 3 mm', { dx: 210, dy: 60, op: pulse(L2 + 0.8, L3 + 0.6, t), cls: 'cyan' });
    show('#ov-weather', ss(L3, L3 + 0.4, t));
  };
}

function toothSvg(lift, shiftSteps) {
  // Heights in mm from the Python: head surface = base surface + 0.15 clearance + lift, offset by the turn
  const scale = 120, pitch = 1.344 * scale, tooth = 0.8 * scale, baseline = 215;
  const zig = (x) => { const u = ((x / pitch) % 1 + 1) % 1; return 2 * Math.abs(u - 0.5); };
  const pts = (offset, lifted) => {
    const out = [];
    for (let x = -pitch; x <= 620 + pitch; x += pitch / 2) {
      out.push([x + offset, baseline - zig(x) * tooth - lifted]);
    }
    return out;
  };
  const base = pts(0, 0);
  const shiftPx = shiftSteps * pitch;
  const clearance = 0.15 * scale;
  const head = pts(shiftPx, clearance + lift * scale);
  const poly = (list, closeY) => `${list.map((p) => p.join(',')).join(' ')} ${list[list.length - 1][0]},${closeY} ${list[0][0]},${closeY}`;
  return `
    <polygon points="${poly(head, -10)}" fill="#2f73c4"/><polyline points="${head.map((p) => p.join(',')).join(' ')}" fill="none" stroke="#9cd0ff" stroke-width="2"/>
    <polygon points="${poly(base, 340)}" fill="#4a525d"/><polyline points="${base.map((p) => p.join(',')).join(' ')}" fill="none" stroke="#c5ced8" stroke-width="2"/>
    <text x="18" y="34" fill="#cfe5ff" font-size="20" font-weight="600" font-family="Inter">head</text>
    <text x="18" y="312" fill="#dfe5ec" font-size="20" font-weight="600" font-family="Inter">lower cheek</text>`;
}

function sceneAdjustable(S, F, A, facts) {
  const wedge = part('final', WEDGE);
  const finalWedge = part('angle_12', WEDGE);
  const base = part('base', BASE, 0.28);
  const head = part('head', HEAD, 0.25);
  const cameraBody = standIn();
  cameraBody.position.set(A.PLATE_FRONT, 0, F.HEIGHT / 2);
  const fan = viewFan();
  fan.position.set(A.PLATE_FRONT + 24, 0, F.HEIGHT / 2 + 26);
  const metal = new THREE.MeshPhysicalMaterial({ color: 0xffb224, emissive: 0xff8a00, emissiveIntensity: 0.5, metalness: 0.4, roughness: 0.35 });
  const zCyl = (r, z0, z1, sections = 32) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, z1 - z0, sections), metal);
    m.rotation.x = Math.PI / 2;
    m.position.z = (z0 + z1) / 2;
    return m;
  };
  const clampShaft = zCyl(2, A.CHEEK_Z[0], A.CHEEK_Z[0] + A.CLAMP_SCREW_LENGTH);
  const clampHead = zCyl(3.5, A.CHEEK_Z[0] - 3, A.CHEEK_Z[0], 6);
  const nut = zCyl(A.NUT_ACROSS_FLATS / Math.sqrt(3), A.CHEEK_Z[0] + A.NUT_SEAT_FROM_HEAD, A.CHEEK_Z[0] + A.NUT_SEAT_FROM_HEAD + A.NUT_SLOT_THICKNESS, 6);
  const pivotShaft = zCyl(2, A.CHEEK_Z[1] - A.CLAMP_SCREW_LENGTH, A.CHEEK_Z[1]);
  const pivotHead = zCyl(3.5, A.CHEEK_Z[1], A.CHEEK_Z[1] + 3, 6);
  const clamp_ = group(clampShaft, clampHead, nut);
  const pivotPin = group(pivotShaft, pivotHead);
  const driver = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 120, 24), new THREE.MeshPhysicalMaterial({ color: 0xdde2e8, metalness: 0.8, roughness: 0.3 }));
  driver.rotation.x = Math.PI / 2;
  const headPivot = group(head, cameraBody, fan);
  const assembly = group(base, headPivot, clamp_, pivotPin, driver);
  const g = group(wedge, finalWedge, assembly);
  world.add(g);
  S.group = g;
  const steps = [0, 4, 8, 12, 16, 20];
  $('#adj-pips').innerHTML = steps.map((a) => `<i>${a}°</i>`).join('');
  const pips = [...document.querySelectorAll('#adj-pips i')];
  const insetSvg = $('#inset svg');
  const insetCap = $('#inset .cap');

  S.update = (t) => {
    const starts = S.lines.map((l) => l.start), ends = S.lines.map((l) => l.end);
    const [L0, L1, L2, L3, L4, L5, L6] = starts;
    bloom.strength = 0.34;
    gridMaterial.uniforms.strength.value = 0.6;

    // Split, separate and rejoin
    const swap = ss(L1 + 0.6, L1 + 1.3, t);
    const explode = ss(L1 + 1.3, L1 + 2.6, t) * (1 - ss(L2 - 1.2, L2 - 0.1, t));
    // Raised and faded out so the base's teeth can be seen
    const aside = pulse(L2 - 0.1, L3 - 0.1, t, 0.9);
    const xray = pulse(L3 - 0.1, L4 - 0.2, t, 0.6);

    // Angle: 8 for the opening, then one worked step to 12, then the six positions
    const firstTurn = [L4 + 1.8, L4 + 3.6], firstLift = [L4 + 0.9, L4 + 1.7], drop = [L4 + 3.7, L4 + 4.5];
    let angle = 8 + 4 * ss(firstTurn[0], firstTurn[1], t);
    let lift = pulse(firstLift[0], drop[1], t, drop[1] - drop[0]) * 0.7;
    const tick = (i) => L5 + 0.3 + i * 3.6 / 5;
    let reached = -1;
    if (t >= L5 - 0.4) {
      angle = lerp(12, 0, ss(L5 - 0.4, tick(0) - 0.05, t));
      lift = 0.7 * pulse(L5 - 0.4, tick(0), t, 0.1);
      for (let i = 1; i < 6; i++) {
        if (t > tick(i - 1)) {
          angle = lerp(steps[i - 1], steps[i], ss(tick(i - 1) + 0.12, tick(i) - 0.14, t));
          lift = 0.7 * pulse(tick(i - 1) + 0.03, tick(i), t, 0.1);
        }
      }
      for (let i = 0; i < 6; i++) if (t >= tick(i)) reached = i;
    }
    if (t > tick(5) + 0.5) {
      angle = lerp(20, 12, ss(tick(5) + 0.5, L6 - 0.1, t));
      lift = 0.7 * pulse(tick(5) + 0.4, L6, t, 0.15);
    }

    wedge.fade(1 - swap);
    base.fade(swap * (1 - 0.82 * xray), 1.6);
    head.fade(swap * (1 - 0.82 * xray) * (1 - aside), 1.6);
    assembly.visible = swap > 0.004;
    const showCamera = ss(L3 + 0.2, L3 + 0.9, t);
    cameraBody.visible = t > L3 + 0.2;
    cameraBody.children.forEach((c) => { c.visible = showCamera > 0.5; });
    fan.visible = t > L5 - 0.2 && t < L6;
    clamp_.visible = pivotPin.visible = xray > 0.02;
    clamp_.position.z = lift;
    driver.visible = xray > 0.3;
    driver.position.set(A.AXIS_X, A.AXIS_Y, A.CHEEK_Z[0] - 3 - 60 - 70 * (1 - ss(L3 + 1.6, L3 + 2.8, t)));
    headPivot.position.set(A.AXIS_X + 75 * explode, A.AXIS_Y, lift + 40 * aside);
    headPivot.rotation.z = rad(-angle);
    clamp_.position.x = pivotPin.position.x = A.AXIS_X;
    clamp_.position.y = pivotPin.position.y = A.AXIS_Y;

    const fixedIn = ss(L6 + 0.2, L6 + 1.2, t);
    finalWedge.fade(fixedIn);
    finalWedge.position.set(-20 + 20 * (1 - fixedIn), -115, 0);

    const centre = [28, 27, 55];
    const teeth = [A.AXIS_X - 19, A.AXIS_Y, A.DRUM_Z[0]];
    const low = [A.AXIS_X, A.AXIS_Y, 40];
    floor.visible = camera.position.z > 8;
    cam(t, [
      [S.start, -30, 16, 430, centre, 0.17], [L1 + 1.1, -40, 18, 430, centre, 0.17],
      [L1 + 2.6, -55, 24, 520, [55, 27, 55], 0.14], [L2 - 0.9, -40, 20, 430, centre, 0.14],
      [L2 + 0.5, 24, 40, 205, teeth, 0.19], [L3 - 0.6, 8, 48, 190, teeth, 0.19],
      [L3 + 0.6, 205, -20, 470, centre, 0.14], [L4 - 0.5, 235, -26, 450, centre, 0.14],
      [L4 + 0.7, 288, 52, 400, [40, 22, 70], 0.17], [L5, 282, 58, 470, [60, 10, 60], 0.17],
      [L6, 278, 60, 520, [80, 0, 60], 0.17], [L6 + 1.3, 300, 28, 560, [20, -30, 55], 0.1],
      [S.end, 312, 24, 540, [20, -30, 55], 0.1],
    ]);
    floor.visible = camera.position.z > 8;

    show('#ov-adjustable', 1);
    show('#question', pulse(S.start + 0.1, L1 + 0.7, t));
    const insetOn = Math.max(pulse(L2 + 0.4, L3 - 0.2, t), pulse(L4 + 0.1, L5 - 0.3, t));
    show('#inset', insetOn);
    if (insetOn > 0) {
      const shift = (angle - 8) / 4;
      insetSvg.innerHTML = toothSvg(lift, t >= L4 ? shift : 0);
      insetCap.textContent = t < L3 ? 'Meshed, with 0.15 mm clearance' : lift > 0.65 ? 'Lifted 0.7 mm: the teeth clear each other' : lift > 0.02 ? 'Moving' : `Meshed at ${Math.round(angle)}°`;
    }
    const readoutOn = pulse(L4 + 0.5, L6 + 0.6, t);
    show('#adj-readout', readoutOn);
    $('#adj-readout .v').textContent = `${Math.round(angle)}°`;
    pips.forEach((p, i) => p.classList.toggle('on', i <= reached));
    $('#adj-pips').style.opacity = t >= L5 - 0.2 ? 1 : 0;
    show('#adj-cmd', ss(L6 + 0.9, L6 + 1.4, t));
    $('#adj-cmd-a').textContent = '12';

    const pz = (z) => [A.AXIS_X, A.AXIS_Y, z];
    callout([0, 0, 110], 'base', { dx: -60, dy: -50, op: pulse(L1 + 1.6, L2 - 1.2, t), cls: 'amber', sub: 'fixes to the surface' });
    callout([A.AXIS_X + 75 + A.PLATE_FRONT, 0, 110], 'head', { dx: 60, dy: -50, op: pulse(L1 + 1.6, L2 - 1.2, t), cls: 'blue', sub: 'carries the camera' });
    callout(teeth, 'locking teeth, 4° apart', { dx: 300, dy: -120, op: pulse(L2 + 0.6, L3 - 0.5, t) });
    callout(pz(A.CHEEK_Z[0] - 2), 'clamp screw', { dx: 250, dy: 80, op: pulse(L3 + 0.8, L4 - 0.3, t), sub: 'pulls the teeth together' });
    callout(pz(A.CHEEK_Z[1]), 'pivot screw', { dx: 240, dy: -40, op: pulse(L3 + 1.4, L4 - 0.3, t), sub: 'only a hinge pin' });
    callout([A.AXIS_X + 40, A.AXIS_Y - 20, 55], "camera's view", { op: fan.visible ? 0.9 : 0, cls: 'cyan', dx: 240, dy: 10 });
    callout([finalWedge.position.x, finalWedge.position.y, 110], 'one-piece wedge', { dx: -30, dy: -50, op: fixedIn, sub: 'one solid block, at that exact angle' });
    void ends; void L0; void low;
  };
}

function scenePrint(S, A) {
  const bed = new THREE.Mesh(new RoundedBoxGeometry(250, 250, 4, 4, 2), new THREE.MeshPhysicalMaterial({ color: 0x1a1f27, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.3 }));
  bed.position.z = -2;
  bed.receiveShadow = true;
  const bedEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(250, 250, 0.1)), new THREE.LineBasicMaterial({ color: 0x5aa9ff, transparent: true, opacity: 0.4 }));
  const top = new THREE.Plane(v3(0, 0, -1), 0), bottom = new THREE.Plane(v3(0, 0, 1), 0);
  const printed = (name, color, x, y) => {
    const front = part(name, color, 0.25);
    front.children[0].material.clippingPlanes = [top];
    front.children[0].material.clipShadows = true;
    front.children[1].material.clippingPlanes = [top];
    const inside = new THREE.Mesh(geometries[name], new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.8), side: THREE.BackSide, clippingPlanes: [top], roughness: 0.8 }));
    const band = new THREE.Mesh(geometries[name], new THREE.MeshBasicMaterial({ color: new THREE.Color(AMBER).multiplyScalar(2.4), side: THREE.DoubleSide, clippingPlanes: [top, bottom] }));
    const g = group(front, inside, band);
    g.position.set(x, y, 0);
    return g;
  };
  const basePart = printed('print_base', BASE, -55, 8);
  const headPart = printed('print_head', HEAD, -55, -72);
  const heads = [
    new THREE.Mesh(new THREE.ConeGeometry(3.4, 8, 24), new THREE.MeshStandardMaterial({ color: 0xd8a460, metalness: 0.9, roughness: 0.25 })),
    new THREE.Mesh(new THREE.BoxGeometry(22, 22, 14), new THREE.MeshPhysicalMaterial({ color: 0x8c95a1, metalness: 0.7, roughness: 0.35 })),
    new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 90, 16), new THREE.MeshPhysicalMaterial({ color: 0x9aa3af, metalness: 0.8, roughness: 0.3 })),
  ];
  heads[0].rotation.x = -Math.PI / 2; heads[0].position.z = 4;
  heads[1].position.z = 15;
  heads[2].rotation.x = Math.PI / 2; heads[2].position.z = 67;
  const nozzle = group(...heads);
  const g = group(bed, bedEdge, basePart, headPart, nozzle);
  world.add(g);
  S.group = g;
  const specs = [...document.querySelectorAll('.spec')];
  $('#print-check .row').innerHTML = [0, 4, 8, 12, 16, 20].map((a) => `<i>${a}°</i>`).join('');
  const checks = [...document.querySelectorAll('#print-check i')];
  S.update = (t) => {
    const [L0, L1, L2] = S.lines.map((l) => l.start);
    const E2 = S.lines[2].end;
    bloom.strength = 0.42;
    floor.visible = false;
    const progress = clamp((t - S.start - 0.3) / (L2 + 1 - S.start));
    const h = lerp(0.2, 42.01, ss(0, 1, progress) * 0.35 + progress * 0.65);
    top.constant = h;
    bottom.constant = -(h - 0.7);
    [basePart, headPart].forEach((p) => p.children[0].fade(1));
    // Sweeps across whichever part this moment of the print is on
    const onHead = Math.floor(t * 1.2) % 2 === 0;
    const px = -55 + 55 + Math.sin(t * 5.1) * 52;
    const py = (onHead ? -72 + 27 : 8 + 27) + Math.sin(t * 13.7) * 22;
    nozzle.position.set(px, py, h + 0.1);
    nozzle.visible = progress < 1;
    cam(t, [[S.start, -68, 34, 660, [0, -10, 18], 0], [L1, -48, 30, 620, [0, -10, 18], 0], [S.end, -24, 34, 600, [0, -10, 18], 0]]);
    show('#ov-print', ss(S.start, S.start + 0.3, t));
    specs.forEach((el, i) => { el.style.opacity = ss(L1 + 0.3 + i * 0.9, L1 + 0.7 + i * 0.9, t); });
    show('#print-check', ss(L2 - 0.1, L2 + 0.3, t));
    const span = E2 - L2;
    checks.forEach((c, i) => c.classList.toggle('on', t >= L2 + 0.4 + i * span / 6.5));
    callout([-55 + 55, 8 + 55, 0], 'base: back face on the bed', { dx: -40, dy: -340, op: pulse(L0 + 0.5, L1 - 0.1, t), sub: 'no supports needed' });
    callout([-55 + 110, -72 + 27, 21], 'head: camera face on the bed', { dx: 270, dy: 90, op: pulse(L0 + 2.6, L1 + 1, t), cls: 'blue', sub: 'supports inside the pocket, not shown' });
  };
}

function sceneOutro(S, F, A, facts) {
  const wedge = part('final', WEDGE);
  const base = part('base', BASE, 0.28);
  const head = part('head', HEAD, 0.25);
  const headPivot = group(head);
  headPivot.position.set(A.AXIS_X, A.AXIS_Y, 0);
  headPivot.rotation.z = rad(-8);
  const adjustable = group(base, headPivot);
  adjustable.position.set(40, 40, 0);
  wedge.position.set(-60, -50, 0);
  const g = group(wedge, adjustable);
  world.add(g);
  S.group = g;

  const size = (bytes) => bytes >= 1024 ? `${Math.round(bytes / 1024)} KB` : `${bytes} B`;
  const sortKey = (f) => (f.name.endsWith('.py') ? 0 : f.name.endsWith('.stl') ? 1 : f.name.endsWith('.png') ? 2 : 3);
  const files = [...facts.repo.files].sort((a, b) => sortKey(a) - sortKey(b));
  $('#files-body').innerHTML = files.map((f) => `<div class="f ${f.name.split('.').pop()}"><span>${f.name}</span><span>${size(f.bytes)}</span></div>`).join('');
  $('#commits-body').innerHTML = facts.repo.commits.map((c) => `<div><em>${c.hash}</em>${c.subject}</div>`).join('');
  const mantra = [...document.querySelectorAll('#mantra span')];
  S.update = (t) => {
    const [L0, L1, L2] = S.lines.map((l) => l.start);
    bloom.strength = 0.38;
    gridMaterial.uniforms.strength.value = 0.6;
    wedge.fade(1); base.fade(1, 1.6); head.fade(1, 1.6);
    const target = [10, 0, 55];
    cam(t, [[S.start, -45, 18, 640, target, 0.25], [L2, -20, 18, 640, target, 0.25], [S.end, 40, 20, 560, target, 0.22]]);
    show('#ov-outro', 1);
    show('#files', ss(S.start, S.start + 0.4, t) * (1 - ss(L1 + 0.1, L1 + 0.7, t)));
    show('#commits', ss(S.start + 0.6, S.start + 1, t) * (1 - ss(L1 + 0.1, L1 + 0.7, t)));
    const span = S.lines[1].end - L1;
    show('#mantra', 1);
    mantra.forEach((m, i) => {
      m.style.opacity = ss(L1 + i * span / 3, L1 + i * span / 3 + 0.25, t) * (1 - ss(L2, L2 + 0.4, t));
      m.style.color = i === 2 ? 'var(--amber)' : 'var(--ink)';
    });
    show('#end', ss(L2, L2 + 0.7, t));
  };
}

// ---------------------------------------------------------------- timeline

let timeline, order;
const fadeEl = $('#fade'), captionEl = $('#caption');

function renderAt(t) {
  const S = order.find((s) => t < s.end) ?? order[order.length - 1];
  order.forEach((s) => { s.group.visible = s === S; show(`#ov-${s.id}`, 0); });
  floor.visible = true;
  floor.position.z = 0;
  gridMaterial.uniforms.strength.value = 1;
  bloom.strength = 0.3;
  S.update(t);
  flushCallouts();
  const index = order.indexOf(S);
  const first = index === 0, last = index === order.length - 1;
  const dipIn = first ? 1 - ss(0, 1.2, t) : 1 - ss(S.start, S.start + 0.3, t);
  const dipOut = last ? ss(S.end - 1.2, S.end - 0.1, t) : ss(S.end - 0.3, S.end, t);
  fadeEl.style.opacity = Math.max(dipIn, dipOut);
  // Title scene has no heading; other scenes number from 1
  $('#chip').style.opacity = first || last ? 0 : 0.95;
  $('#chip-n').textContent = String(index).padStart(2, '0');
  $('#chip-t').textContent = S.title;
  $('#repo').style.opacity = first ? 0 : 1;
  $('#progress').style.width = `${t / timeline.duration * 100}%`;
  const line = S.lines.find((l) => t >= l.start - 0.1 && t < l.end + 0.2);
  captionEl.style.display = line ? 'block' : 'none';
  if (line) captionEl.textContent = line.caption;
  composer.render();
  renderer.getContext().finish();
}

// The scan's pencil is faint; a curve on each pixel darkens it and leaves the paper white
async function inkScan(url) {
  const image = new Image();
  image.src = url;
  await image.decode();
  const c = document.createElement('canvas');
  c.width = image.width; c.height = image.height;
  const g = c.getContext('2d');
  g.drawImage(image, 0, 0);
  const pixels = g.getImageData(0, 0, c.width, c.height);
  const curve = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) curve[i] = 255 * Math.pow(i / 255, 3.4);
  for (let i = 0; i < pixels.data.length; i += 4) {
    for (let n = 0; n < 3; n++) pixels.data[i + n] = curve[pixels.data[i + n]];
  }
  g.putImageData(pixels, 0, 0);
  return c;
}

async function start() {
  await document.fonts.ready;
  const fetchJson = async (url) => (await fetch(url)).json();
  const [facts, data] = await Promise.all([fetchJson(`${ASSETS}facts.json`), fetchJson('/video/build/timeline.json')]);
  timeline = data;
  const names = ['stage_0', 'stage_1', 'stage_2', 'stage_3', 'stage_4', 'stage_5', 'cutter_1', 'cutter_2', 'cutter_3', 'cutter_4', 'cutter_5', 'cutter_6',
    'base', 'head', 'print_base', 'print_head', ...facts.sweep.map((s) => `angle_${s.angle}`)];
  await Promise.all(names.map(load));
  // The committed STL itself, not a regenerated copy
  const committed = await loader.loadAsync('/ring_camera_wedge.stl');
  committed.computeVertexNormals();
  geometries.final = toCreasedNormals(committed, rad(32));
  edgeGeometries.final = new THREE.EdgesGeometry(committed, 30);

  const F = facts.fixed, A = facts.adjustable;
  for (const S of timeline.scenes) scenes[S.id] = S;
  sceneTitle(scenes.title);
  sceneSketch(scenes.sketch, F, await inkScan('/Scan_20261101.png'));
  sceneCode(scenes.code, F, facts.repo.source['ring_camera_wedge.py']);
  sceneCarve(scenes.carve, F, facts);
  sceneAngle(scenes.angle, F, facts);
  sceneStl(scenes.stl, F, facts, committed);
  sceneWeather(scenes.weather, F, facts);
  sceneAdjustable(scenes.adjustable, F, A, facts);
  scenePrint(scenes.print, A);
  sceneOutro(scenes.outro, F, A, facts);
  order = timeline.scenes;

  // Let the sketch texture arrive before the first frame
  await new Promise((resolve) => setTimeout(resolve, 500));
  window.renderAt = renderAt;
  window.timelineInfo = { duration: timeline.duration, fps: timeline.fps, scenes: order.map(({ id, start: s, end, lines }) => ({ id, start: s, end, lines })) };
  window.sceneReady = true;
}

start().catch((error) => { window.sceneError = String(error.stack || error); });
