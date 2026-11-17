// three.js 화면(v3 "커머스 클린"). model.js가 만든 상자 목록을 그대로 그린다(회전·치수 계산은 model.js에만 있다).
// 좌표: 평면 (x, y) → three (x, 높이, z = y). 단위 cm. 색·빛 규칙은 docs/design-v3/a/notes.md 6절.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { WALLS, WALL_T, SLAB, SCENE, normRoom, colorsOf, roomModel, itemBoxes, eyeView } from './model.js';

const usable = (it) => it && [it.x, it.y, it.w, it.d, it.h].every(Number.isFinite) && it.w > 0 && it.d > 0 && it.h > 0 && [0, 90, 180, 270].includes(it.rot);
const UP = new THREE.Vector3(0, 1, 0);
// 캔버스 가장자리 24px을 흐리게 지운다 → 방 아래 그림자나 확대한 방이 네모나게 잘려 보이지 않는다
const FADE = ['90deg', '180deg'].map((a) => `linear-gradient(${a}, transparent, #000 24px, #000 calc(100% - 24px), transparent)`).join(', ');
const rad = THREE.MathUtils.degToRad;

// 방 아래에 깔리는 흐린 그림자(방이 살짝 떠 보인다)
function blobTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d'), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(27,42,68,.34)');
  grad.addColorStop(0.55, 'rgba(27,42,68,.2)');
  grad.addColorStop(1, 'rgba(27,42,68,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createViewer(host, onPick) {
  // 배경은 그리지 않는다(투명) → 뒤에 있는 캔버스 바탕(--bg)이 그대로 보인다
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace; // 톤 매핑은 쓰지 않는다 → 평면도와 같은 색이 그대로 나온다
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // three 0.187에는 PCFSoftShadowMap이 없다(쓰면 경고). PCF + radius가 부드러운 그림자다
  renderer.shadowMap.autoUpdate = false; // 빛은 움직이지 않으니 장면이 바뀔 때만 그림자를 다시 계산한다
  const canvas = renderer.domElement;
  Object.assign(canvas.style, { display: 'block', width: '100%', height: '100%', touchAction: 'none', outline: 'none' });
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '방을 입체로 본 모습');
  host.appendChild(canvas);

  // 화면의 CSS 변수(없으면 빈 글자)
  const css = (name) => getComputedStyle(host).getPropertyValue(name).trim();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(20, 1, 5, 60000);
  const controls = new OrbitControls(camera, canvas);
  controls.maxPolarAngle = Math.PI / 2 - 0.03; // 바닥 아래로 내려가지 않게
  controls.minDistance = 30;

  // 반구광이 거의 전부이고, 방향광 하나가 면마다 밝기 차이와 옅은 그림자(약 15%)를 만든다.
  // three 0.187의 빛 단위는 π가 곱해져야 "1 = 원래 색"이다(0.86π + 0.2π × 기울기 ≈ 윗면 1.0).
  const hemi = new THREE.HemisphereLight('#ffffff', '#e8edf3', 0.86 * Math.PI);
  const sun = new THREE.DirectionalLight('#ffffff', 0.2 * Math.PI);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 2;
  sun.shadow.radius = 6;
  const roomGroup = new THREE.Group(), itemsGroup = new THREE.Group(), markGroup = new THREE.Group();
  scene.add(hemi, sun, sun.target, roomGroup, itemsGroup, markGroup);

  // 크기 1짜리 기본 도형을 늘려서 쓴다 → 도형을 몇 개만 만들면 된다
  const unit = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 32),
    shade: new THREE.CylinderGeometry(0.3, 0.5, 1, 32),
    pot: new THREE.CylinderGeometry(0.5, 0.38, 1, 24),
    leaf: new THREE.SphereGeometry(0.5, 12, 10).translate(0, 0.5, 0), // 밑동이 원점인 길쭉한 잎
  };
  unit.cylf = unit.cyl;
  // shortcut: 둥근 상자와 재질은 화면을 닫을 때까지 모아 둔다(크기·색 종류가 수백 개 수준). 수천 개가 되면 장면마다 비우기.
  const softCache = new Map(), matCache = new Map();
  const blob = blobTexture();
  let owned = []; // 장면을 다시 만들 때 버릴 것(문짝 도형 등)

  function material(bx) {
    const key = `${bx.c}|${bx.o || 1}|${bx.g || 0}|${bx.e || 0}`;
    if (!matCache.has(key)) {
      matCache.set(key, new THREE.MeshStandardMaterial({
        color: bx.c, roughness: bx.g ? 0.25 : 0.9, metalness: 0,
        transparent: (bx.o || 1) < 1, opacity: bx.o || 1, depthWrite: (bx.o || 1) >= 1,
        emissive: bx.e ? bx.c : '#000000', emissiveIntensity: bx.e || 0,
      }));
    }
    return matCache.get(key);
  }

  function meshOf(bx) {
    const sx = bx.x1 - bx.x0, sy = bx.t - bx.b, sz = bx.y1 - bx.y0;
    let mesh;
    if (bx.s === 'soft') {
      const key = [sx, sy, sz].map((v) => v.toFixed(1)).join('|');
      if (!softCache.has(key)) softCache.set(key, new RoundedBoxGeometry(sx, sy, sz, 3, Math.min(2.5, Math.min(sx, sy, sz) * 0.3)));
      mesh = new THREE.Mesh(softCache.get(key), material(bx));
    } else {
      mesh = new THREE.Mesh(unit[bx.s] || unit.box, material(bx));
      if (bx.s !== 'cylf') mesh.scale.set(sx, sy, sz);
      else if (bx.ax === 'y') { mesh.rotation.x = Math.PI / 2; mesh.scale.set(sx, sz, sy); } // 원통을 눕힌다(축이 평면 y)
      else { mesh.rotation.z = Math.PI / 2; mesh.scale.set(sy, sx, sz); } // 축이 평면 x
    }
    mesh.position.set((bx.x0 + bx.x1) / 2, (bx.b + bx.t) / 2, (bx.y0 + bx.y1) / 2);
    if (bx.s === 'leaf') { mesh.position.y = bx.b; mesh.rotation.set(0, bx.az, -bx.lean, 'YXZ'); } // 밑동에서 바깥으로 눕힌다
    mesh.castShadow = true;
    mesh.receiveShadow = !bx.e; // 흰 벽과 전등갓에는 그림자를 얹지 않는다(시안처럼 벽이 깨끗하게)
    return mesh;
  }

  // 축에 나란하지 않은 기둥(열린 문짝)
  function polyMesh(q) {
    const shape = new THREE.Shape(q.pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: q.t - q.b, bevelEnabled: false });
    owned.push(geo);
    const mesh = new THREE.Mesh(geo, material(q));
    mesh.rotation.x = Math.PI / 2; // 도형의 y → 평면 y(three z), 돌출 방향 → 아래. 그래서 위쪽 높이에 놓는다
    mesh.position.y = q.t;
    mesh.receiveShadow = true;
    return mesh;
  }

  let room = null, C = null, roomKey = '', view = 'bird', sized = false, touched = false, selected = null, wallParts = {}, ceiling = null, reach = 1000;
  let shown = [], cam = null; // 지금 그린 가구, 조감 때 카메라가 서는 모서리 [x 쪽, z 쪽]

  // 카메라가 설 모서리를 고르고 빛을 놓는다. 키 큰 가구가 카메라 앞을 가리지 않는 모서리가 좋다(카메라 쪽 두 벽은 숨겨진다).
  // 비슷하면 창문 벽이 보이고 평면도처럼 위쪽 벽이 뒤에 오는 쪽. 지금 모서리는 15% 넘게 나쁠 때만 바꾼다(가구를 조금 옮겼다고 화면이 뒤집히지 않게).
  function aim() {
    const { width: W, depth: D, height: H } = room, ww = room.windows[0]?.wall;
    let best = Infinity, pick = cam;
    for (const sx of [1, -1]) for (const sz of [1, -1]) {
      let cost = (ww === (sx > 0 ? 'right' : 'left') || ww === (sz > 0 ? 'bottom' : 'top') ? 1 : 0) + (sz < 0 ? 0.5 : 0);
      for (const it of shown) {
        const turned = it.rot % 180 !== 0, cx = (it.x + (turned ? it.d : it.w) / 2) / W, cz = (it.y + (turned ? it.w : it.d) / 2) / D;
        cost += (it.h / 100) ** 2 * ((sx > 0 ? cx : 1 - cx) + (sz > 0 ? cz : 1 - cz));
      }
      if (cam && cam[0] === sx && cam[1] === sz) cost *= 0.85;
      if (cost < best) { best = cost; pick = [sx, sz]; }
    }
    cam = pick;
    // 빛은 카메라 기준으로 왼쪽 앞 위에서 온다 → 보이는 두 벽이 밝고 그림자는 짧게 뒤로 떨어진다
    const R = Math.hypot(W, D) / 2 + 40, side = cam[0] * cam[1] > 0 ? [0.3, 0.95] : [0.95, 0.3];
    sun.target.position.set(W / 2, 0, D / 2);
    sun.position.set(W / 2 + cam[0] * R * side[0], R * 1.75 + H, D / 2 + cam[1] * R * side[1]);
    Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 10, far: R * 4 + H * 2 });
    sun.shadow.camera.updateProjectionMatrix();
    renderer.shadowMap.needsUpdate = true;
  }

  function buildRoom() {
    for (const o of owned) o.dispose();
    owned = [];
    roomGroup.clear();
    const { width: W, depth: D, height: H } = room, m = roomModel(room), T = m.T;

    // 바닥: 무늬 없는 단색 판
    const slab = meshOf({ s: 'box', c: SCENE.floor, x0: -T, x1: W + T, y0: -T, y1: D + T, b: -SLAB, t: 0 });
    slab.castShadow = false;
    const blobMat = new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false });
    const under = new THREE.Mesh(new THREE.PlaneGeometry((W + T * 2) * 1.5, (D + T * 2) * 1.5), blobMat);
    under.rotation.x = -Math.PI / 2;
    under.position.set(W / 2, -SLAB - 12, D / 2);
    // 천장은 아래를 보는 한 면짜리라서 위에서 내려다보면 사라진다. 방 안에 있을 때만 켠다(render 참고)
    const ceilMat = new THREE.MeshBasicMaterial({ color: SCENE.wall });
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W + T * 2, D + T * 2), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(W / 2, H, D / 2);
    owned.push(blobMat, under.geometry, ceilMat, ceil.geometry);
    roomGroup.add(under, slab, ceil);
    ceiling = ceil;

    wallParts = {};
    for (const wall of WALLS) {
      const g = new THREE.Group();
      for (const bx of m.walls[wall].boxes) g.add(meshOf(bx));
      for (const q of m.walls[wall].polys) g.add(polyMesh(q));
      for (const o of g.children) o.castShadow = false; // 벽·창틀·문짝은 그림자를 만들지 않는다(벽을 숨겨도 그림자가 바뀌지 않게)
      roomGroup.add(g);
      wallParts[wall] = g;
    }

    reach = Math.hypot(W, D, H) * 2;
  }

  function buildItems(items) {
    itemsGroup.clear();
    shown = items.filter(usable);
    for (const it of shown) {
      const g = new THREE.Group();
      g.userData.uid = it.uid;
      for (const bx of itemBoxes(it, C)) g.add(meshOf(bx));
      itemsGroup.add(g);
    }
  }

  // 고른 가구: 바닥에 테두리 + 상자 모양 선(색은 화면의 --accent)
  function mark() {
    for (const o of markGroup.children) { if (o.geometry !== unit.box) o.geometry?.dispose(); o.material?.dispose(); }
    markGroup.clear();
    const g = itemsGroup.children.find((o) => o.userData.uid === selected);
    if (!g || selected == null) return;
    const color = new THREE.Color(css('--accent') || '#2F81CC'), box = new THREE.Box3().setFromObject(g);
    markGroup.add(new THREE.Box3Helper(box, color));
    const s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3()), k = 2;
    const mat = new THREE.MeshBasicMaterial({ color });
    for (const [w, d, x, z] of [[s.x + k * 4, k, 0, -s.z / 2 - k * 1.5], [s.x + k * 4, k, 0, s.z / 2 + k * 1.5], [k, s.z + k * 2, -s.x / 2 - k * 1.5, 0], [k, s.z + k * 2, s.x / 2 + k * 1.5, 0]]) {
      const bar = new THREE.Mesh(unit.box, mat);
      bar.scale.set(w, 0.8, d);
      bar.position.set(c.x + x, 2.2, c.z + z); // 러그 위에서도 보이게 살짝 띄운다
      markGroup.add(bar);
    }
  }

  // 카메라를 dir 쪽에 두고, 상자(lo~hi)가 화면에 꽉 차면서 가운데 오도록 거리와 볼 곳을 정한다
  function frame(dir, lo, hi, fov) {
    camera.fov = fov;
    const f = dir.clone().negate(), right = new THREE.Vector3().crossVectors(f, UP).normalize(), up = new THREE.Vector3().crossVectors(right, f);
    const tv = Math.tan(rad(fov / 2)) * 0.95, th = tv * camera.aspect; // 가장자리 5%는 비운다
    const target = lo.clone().add(hi).multiplyScalar(0.5), v = new THREE.Vector3();
    let dist = 0;
    for (let pass = 0; pass < 3; pass++) { // 원근 때문에 한 번에 가운데가 맞지 않아서 두 번 더 고친다
      let r0 = Infinity, r1 = -Infinity, u0 = Infinity, u1 = -Infinity;
      const pts = [];
      for (let i = 0; i < 8; i++) {
        v.set(i & 1 ? hi.x : lo.x, i & 2 ? hi.y : lo.y, i & 4 ? hi.z : lo.z).sub(target);
        pts.push([v.dot(right), v.dot(up), v.dot(f)]);
      }
      dist = Math.max(...pts.map(([r, u, d]) => Math.max(Math.abs(r) / th, Math.abs(u) / tv) - d));
      for (const [r, u, d] of pts) { r0 = Math.min(r0, r / (dist + d)); r1 = Math.max(r1, r / (dist + d)); u0 = Math.min(u0, u / (dist + d)); u1 = Math.max(u1, u / (dist + d)); }
      target.addScaledVector(right, ((r0 + r1) / 2) * dist).addScaledVector(up, ((u0 + u1) / 2) * dist);
    }
    controls.target.copy(target);
    camera.position.copy(target).addScaledVector(dir, dist);
    controls.maxDistance = dist * 3;
  }

  // 보는 방향 버튼. 방 크기와 화면 비율에 맞춰 방 전체가 들어오게 한다.
  function applyView(name) {
    view = name;
    touched = false;
    // 눈높이는 방 안이라 화면이 꽉 찬다 → 가장자리를 흐리지 않고 모서리만 둥글게
    Object.assign(canvas.style, name === 'eye' ? { maskImage: 'none', borderRadius: '16px' } : { maskImage: FADE, maskComposite: 'intersect', borderRadius: '' });
    if (!room) return;
    aim();
    const { width: W, depth: D, height: H } = room, T = WALL_T;
    const lo = new THREE.Vector3(-T, -SLAB, -T), hi = new THREE.Vector3(W + T, H, D + T);
    if (name === 'top') {
      frame(new THREE.Vector3(0, 1, 0.0005).normalize(), lo, hi, 20); // 살짝 아래쪽(+z)에 두면 평면도와 같은 방향(위쪽 벽이 화면 위)
    } else if (name === 'eye') {
      camera.fov = 64;
      const { pos, target } = eyeView(room); // 현관문 안쪽에 서서 방을 보는 눈높이
      controls.target.set(target[0], 100, target[1]);
      camera.position.set(pos[0], 150, pos[1]);
      controls.maxDistance = reach * 3;
    } else {
      // 조감: 방위 45°, 높이 35°, 좁은 화각(직교 카메라 느낌)
      const [sx, sz] = cam, e = rad(35), a = rad(45);
      frame(new THREE.Vector3(sx * Math.cos(e) * Math.sin(a), Math.sin(e), sz * Math.cos(e) * Math.cos(a)), lo, hi, 20);
    }
    controls.update();
    invalidate();
  }

  function render() {
    if (!room) return;
    // 카메라가 벽 바깥에 있으면 그 벽을 숨긴다 → 뒤쪽 두 면만 보이고 방 안이 항상 보인다
    const p = camera.position;
    const hide = { top: p.z < 0, bottom: p.z > room.depth, left: p.x < 0, right: p.x > room.width };
    for (const wall of WALLS) wallParts[wall].visible = !hide[wall];
    ceiling.visible = !WALLS.some((wall) => hide[wall]) && p.y < room.height; // 방 안에 있을 때만
    camera.near = Math.max(5, p.distanceTo(controls.target) - reach); // 멀리서 볼 때 깊이 정밀도가 모자라 면이 지글거리지 않게
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  // 움직일 때만 그린다(계속 도는 렌더 루프 없음)
  let raf = 0;
  function invalidate() {
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); });
  }
  controls.addEventListener('change', invalidate);
  const onTouch = () => { touched = true; };
  controls.addEventListener('start', onTouch);

  const ro = new ResizeObserver(([entry]) => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    // 실제 화면 점 개수에 맞춘다(.app 의 zoom 1.15 에서도 흐려지지 않게). 2배까지만: 노트북이 뜨거워지지 않게
    const px = entry?.devicePixelContentBoxSize?.[0]?.inlineSize || 0;
    renderer.setPixelRatio(Math.min(Math.max(px / w, window.devicePixelRatio || 1), 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (!sized || !touched) { sized = true; applyView(view); } // 사용자가 돌려 둔 시점이 아니면 새 크기에 다시 맞춘다
    render(); // 크기를 바꾸면 화면이 지워지므로 바로 다시 그린다(깜빡임 방지)
  });
  ro.observe(host);

  // 끌지 않고 누른 것만 "고르기"로 본다
  let down = null;
  const onDown = (e) => { down = [e.clientX, e.clientY]; };
  const onUp = (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    const r = canvas.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    let o = ray.intersectObjects(itemsGroup.children, true)[0]?.object;
    while (o && o.userData.uid === undefined) o = o.parent;
    onPick(o ? o.userData.uid : null);
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);

  return {
    setScene(rawRoom, items, style) {
      const nextRoom = normRoom(rawRoom), key = JSON.stringify(nextRoom);
      const refit = !room || nextRoom.width !== room.width || nextRoom.depth !== room.depth || nextRoom.height !== room.height;
      room = nextRoom;
      // 화면에 --c1~--c5 가 있으면 그 값을 쓴다 → 평면도와 언제나 같은 색
      C = colorsOf(style, [1, 2, 3, 4, 5].map((i) => css(`--c${i}`)));
      if (key !== roomKey) { roomKey = key; buildRoom(); }
      buildItems(Array.isArray(items) ? items : []);
      mark();
      renderer.shadowMap.needsUpdate = true;
      if (sized && (refit || !touched)) applyView(view); // 사용자가 돌려 둔 시점은 가구만 바뀌었을 때 그대로 둔다
      invalidate();
    },
    setSelected(uid) { selected = uid ?? null; mark(); invalidate(); },
    setView: applyView,
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      controls.dispose();
      selected = null;
      mark();
      for (const o of [...owned, ...Object.values(unit), ...softCache.values(), ...matCache.values(), blob, sun.shadow]) o.dispose();
      renderer.dispose();
      renderer.forceContextLoss(); // 브라우저의 WebGL 컨텍스트 개수 제한에 걸리지 않게 바로 돌려준다
      canvas.remove();
    },
  };
}
