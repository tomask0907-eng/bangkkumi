// three.js 화면. model.js가 만든 상자 목록을 그대로 그린다(회전·치수 계산은 model.js에만 있다).
// 좌표: 평면 (x, y) → three (x, 높이, z = y). 단위 cm.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { WALLS, normRoom, colorsOf, roomModel, itemBoxes, eyeView, shade, mix } from './model.js';

const ACCENT = '#ff6b35'; // 고른 가구 표시색
const usable = (it) => it && [it.x, it.y, it.w, it.d, it.h].every(Number.isFinite) && it.w > 0 && it.d > 0 && it.h > 0 && [0, 90, 180, 270].includes(it.rot);

// 바닥 마루 무늬. 가로 512px = 240cm, 세로 512px = 120cm(널 폭 15cm). 좌우·상하로 이어 붙여도 티가 나지 않게 그린다.
function plankTexture(hex) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const g = cv.getContext('2d');
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let r = 0; r < 8; r++) {
    const y = r * 64, joints = [];
    for (let x = rand() * 200; x < 512; x += 190 + rand() * 150) joints.push(x);
    joints.forEach((x0, i) => {
      const x1 = joints[(i + 1) % joints.length];
      g.fillStyle = shade(hex, (rand() - 0.5) * 0.13);
      if (x1 > x0) g.fillRect(x0, y, x1 - x0, 64);
      else { g.fillRect(x0, y, 512 - x0, 64); g.fillRect(0, y, x1, 64); } // 끝을 넘어가는 널은 반대쪽에서 이어진다
      g.fillStyle = 'rgba(0,0,0,0.16)';
      g.fillRect(x0, y, 1.5, 64);
    });
    g.fillStyle = 'rgba(0,0,0,0.045)'; // 나뭇결
    for (let k = 0; k < 5; k++) g.fillRect(0, y + 6 + rand() * 52, 512, 1);
    g.fillStyle = 'rgba(0,0,0,0.15)';
    g.fillRect(0, y, 512, 1.5);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createViewer(host, onPick) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); // 고해상도 화면에서도 노트북이 뜨거워지지 않게
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping; // 팔레트 색이 탁해지지 않는 톤 매핑
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false; // 해는 움직이지 않으니 장면이 바뀔 때만 그림자를 다시 계산한다
  const canvas = renderer.domElement;
  Object.assign(canvas.style, { display: 'block', width: '100%', height: '100%', touchAction: 'none', outline: 'none' });
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '방을 입체로 본 모습');
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 5, 9000);
  const controls = new OrbitControls(camera, canvas);
  controls.maxPolarAngle = Math.PI / 2 - 0.03; // 바닥 아래로 내려가지 않게
  controls.minDistance = 30;

  const hemi = new THREE.HemisphereLight('#ffffff', '#d8cfc2', 2.3);
  const sun = new THREE.DirectionalLight('#fff0d8', 1.9);
  const fill = new THREE.DirectionalLight('#ffffff', 1.1); // 해 반대쪽 면이 시커멓게 되지 않게 하는 보조광(그림자 없음)
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.001;
  sun.shadow.normalBias = 3;
  sun.shadow.radius = 5;
  const roomGroup = new THREE.Group(), itemsGroup = new THREE.Group(), markGroup = new THREE.Group();
  scene.add(hemi, sun, sun.target, fill, fill.target, roomGroup, itemsGroup, markGroup);

  // 크기 1짜리 기본 도형을 늘려서 쓴다 → 도형을 몇 개만 만들면 된다
  const unit = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 28),
    sph: new THREE.IcosahedronGeometry(0.5, 2),
    shade: new THREE.CylinderGeometry(0.3, 0.5, 1, 28),
    pot: new THREE.CylinderGeometry(0.5, 0.36, 1, 20),
  };
  unit.cylf = unit.cyl;
  // shortcut: 둥근 상자와 재질은 화면을 닫을 때까지 모아 둔다(크기·색 종류가 수백 개 수준). 수천 개가 되면 장면마다 비우기.
  const softCache = new Map(), matCache = new Map();
  let owned = []; // 장면을 다시 만들 때 버릴 것(바닥 무늬, 문짝 도형 등)

  function material(bx) {
    const key = `${bx.c}|${bx.o || 1}|${bx.g || 0}|${bx.e || 0}`;
    if (!matCache.has(key)) {
      matCache.set(key, new THREE.MeshStandardMaterial({
        color: bx.c, roughness: bx.g ? 0.22 : 0.86, metalness: bx.g ? 0.15 : 0,
        transparent: (bx.o || 1) < 1, opacity: bx.o || 1, depthWrite: (bx.o || 1) >= 1,
        emissive: bx.e ? bx.c : '#000000', emissiveIntensity: bx.e ? 0.55 : 0,
      }));
    }
    return matCache.get(key);
  }

  function meshOf(bx) {
    const sx = bx.x1 - bx.x0, sy = bx.t - bx.b, sz = bx.y1 - bx.y0;
    let mesh;
    if (bx.s === 'soft') {
      const key = [sx, sy, sz].map((v) => v.toFixed(1)).join('|');
      if (!softCache.has(key)) softCache.set(key, new RoundedBoxGeometry(sx, sy, sz, 3, Math.min(3.5, Math.min(sx, sy, sz) * 0.3)));
      mesh = new THREE.Mesh(softCache.get(key), material(bx));
    } else {
      mesh = new THREE.Mesh(unit[bx.s] || unit.box, material(bx));
      if (bx.s !== 'cylf') mesh.scale.set(sx, sy, sz);
      else if (bx.ax === 'y') { mesh.rotation.x = Math.PI / 2; mesh.scale.set(sx, sz, sy); } // 원통을 눕힌다(축이 평면 y)
      else { mesh.rotation.z = Math.PI / 2; mesh.scale.set(sy, sx, sz); } // 축이 평면 x
    }
    mesh.position.set((bx.x0 + bx.x1) / 2, (bx.b + bx.t) / 2, (bx.y0 + bx.y1) / 2);
    mesh.castShadow = !bx.wall && !bx.o; // 벽은 그림자를 만들지 않는다(벽을 숨겨도 그림자가 바뀌지 않게)
    mesh.receiveShadow = true;
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
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  }

  let room = null, C = null, roomKey = '', view = 'bird', sized = false, selected = null, wallParts = {}, ceiling = null;

  function buildRoom() {
    for (const o of owned) o.dispose();
    owned = [];
    roomGroup.clear();
    const { width: W, depth: D, height: H } = room, m = roomModel(room, C), T = m.T;

    const tex = plankTexture(C.floor);
    tex.repeat.set(W / 240, D / 120);
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const floorMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.72 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(W / 2, 0, D / 2);
    floor.receiveShadow = true;
    // 받침판 윗면은 바닥보다 2cm 아래. 더 붙이면 멀리서 볼 때 깊이 정밀도가 모자라 바닥 무늬와 번갈아 보인다(지글거림)
    const slab = meshOf({ s: 'box', c: shade(C.wall, -0.14), x0: -T, x1: W + T, y0: -T, y1: D + T, b: -10, t: -2, wall: 1 });
    // 천장은 아래를 보는 한 면짜리라서 위에서 내려다보면 사라진다. 방 안에 있을 때만 켠다(render 참고)
    const ceilMat = new THREE.MeshBasicMaterial({ color: mix(C.wall, '#ffffff', 0.35) });
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W + T * 2, D + T * 2), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(W / 2, H, D / 2);
    owned.push(tex, floorMat, floor.geometry, ceilMat, ceil.geometry);
    roomGroup.add(floor, slab, ceil);
    ceiling = ceil;

    wallParts = {};
    for (const wall of WALLS) {
      const full = new THREE.Group(), stub = new THREE.Group();
      for (const bx of m.walls[wall].boxes) {
        full.add(meshOf(bx));
        if (bx.wall && bx.b === 0) stub.add(meshOf({ ...bx, t: Math.min(bx.t, 12) })); // 숨긴 벽 자리에 남기는 낮은 턱
      }
      for (const q of m.walls[wall].polys) full.add(polyMesh(q));
      roomGroup.add(full, stub);
      wallParts[wall] = { full, stub };
    }

    // 해는 첫 번째 창문 쪽 바깥 위에서 들어온다
    const out = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] }[room.windows[0]?.wall || 'top'];
    const R = Math.hypot(W, D) / 2 + 40;
    sun.target.position.set(W / 2, 0, D / 2);
    sun.position.set(W / 2 + out[0] * R * 0.9 - out[1] * R * 0.45, R * 1.5 + H * 0.4, D / 2 + out[1] * R * 0.9 + out[0] * R * 0.45);
    Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 10, far: R * 5 + H });
    sun.shadow.camera.updateProjectionMatrix();
    fill.target.position.copy(sun.target.position);
    fill.position.set(W / 2 - out[0] * R - out[1] * R * 0.7, R * 1.1, D / 2 - out[1] * R + out[0] * R * 0.7);
    hemi.groundColor.set(mix(C.floor, '#ffffff', 0.45));
    controls.maxDistance = R * 7;
  }

  function buildItems(items) {
    itemsGroup.clear();
    for (const it of items) {
      if (!usable(it)) continue;
      const g = new THREE.Group();
      g.userData.uid = it.uid;
      for (const bx of itemBoxes(it, C)) g.add(meshOf(bx));
      itemsGroup.add(g);
    }
  }

  // 고른 가구: 바닥에 테두리 + 상자 모양 선
  function mark() {
    for (const o of markGroup.children) { if (o.geometry !== unit.box) o.geometry?.dispose(); o.material?.dispose(); }
    markGroup.clear();
    const g = itemsGroup.children.find((o) => o.userData.uid === selected);
    if (!g || selected == null) return;
    const box = new THREE.Box3().setFromObject(g);
    markGroup.add(new THREE.Box3Helper(box, ACCENT));
    const s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3()), k = 3;
    const mat = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.9 });
    for (const [w, d, x, z] of [[s.x + k * 4, k, 0, -s.z / 2 - k * 1.5], [s.x + k * 4, k, 0, s.z / 2 + k * 1.5], [k, s.z + k * 2, -s.x / 2 - k * 1.5, 0], [k, s.z + k * 2, s.x / 2 + k * 1.5, 0]]) {
      const bar = new THREE.Mesh(unit.box, mat);
      bar.scale.set(w, 0.8, d);
      bar.position.set(c.x + x, 0.5, c.z + z);
      markGroup.add(bar);
    }
  }

  // 시점 버튼. 방 크기와 화면 비율에 맞춰 방 전체가 들어오게 한다.
  function applyView(name) {
    view = name;
    if (!room) return;
    const { width: W, depth: D, height: H } = room;
    if (name === 'top') {
      camera.fov = 40;
      const v = Math.tan(THREE.MathUtils.degToRad(20));
      const dist = Math.max((D / 2 + 30) / v, (W / 2 + 30) / (v * camera.aspect)) + H;
      controls.target.set(W / 2, 0, D / 2);
      camera.position.set(W / 2, dist, D / 2 + 0.5); // 살짝 아래쪽(+z)에 두면 평면도와 같은 방향(위쪽 벽이 화면 위)
    } else if (name === 'eye') {
      camera.fov = 64;
      const { pos, target } = eyeView(room); // 현관문 안쪽에 서서 방을 보는 눈높이
      controls.target.set(target[0], 100, target[1]);
      camera.position.set(pos[0], 150, pos[1]);
    } else {
      camera.fov = 40;
      // 창문이 있는 벽이 보이도록 그 반대편 모서리 위에서 본다(카메라 쪽 벽은 숨겨진다)
      const ww = room.windows[0]?.wall, sx = ww === 'right' ? -1 : 1, sz = ww === 'bottom' ? -1 : 1;
      const v = THREE.MathUtils.degToRad(20), half = Math.min(v, Math.atan(Math.tan(v) * camera.aspect));
      const dist = (Math.hypot(W, D, H) / 2) * 0.98 / Math.sin(half);
      const dir = new THREE.Vector3(sx * 0.6, 0.8, sz * 0.95).normalize();
      controls.target.set(W / 2, H * 0.28, D / 2);
      camera.position.copy(controls.target).addScaledVector(dir, dist);
    }
    camera.updateProjectionMatrix();
    controls.update();
    invalidate();
  }

  function render() {
    if (!room) return;
    // 카메라가 벽 바깥에 있으면 그 벽을 숨기고 낮은 턱만 남긴다 → 방 안이 항상 보인다
    const p = camera.position;
    const hide = { top: p.z < 0, bottom: p.z > room.depth, left: p.x < 0, right: p.x > room.width };
    for (const wall of WALLS) {
      wallParts[wall].full.visible = !hide[wall];
      wallParts[wall].stub.visible = hide[wall];
    }
    ceiling.visible = !WALLS.some((wall) => hide[wall]); // 방 밖에서 낮게 볼 때 천장만 떠 보이지 않게
    renderer.render(scene, camera);
  }
  // 움직일 때만 그린다(계속 도는 렌더 루프 없음)
  let raf = 0;
  function invalidate() {
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); });
  }
  controls.addEventListener('change', invalidate);

  const ro = new ResizeObserver(() => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (!sized) { sized = true; applyView(view); } // 처음 크기를 알게 됐을 때 시점을 맞춘다
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
      const nextRoom = normRoom(rawRoom), nextC = colorsOf(style);
      const key = JSON.stringify([nextRoom, nextC]);
      const refit = !room || nextRoom.width !== room.width || nextRoom.depth !== room.depth || nextRoom.height !== room.height;
      room = nextRoom;
      C = nextC;
      if (key !== roomKey) { roomKey = key; buildRoom(); }
      buildItems(Array.isArray(items) ? items : []);
      mark();
      renderer.shadowMap.needsUpdate = true;
      if (refit && sized) applyView(view); // 가구만 옮겼을 때는 사용자가 돌려 둔 시점을 그대로 둔다
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
      for (const o of [...owned, ...Object.values(unit), ...softCache.values(), ...matCache.values(), sun.shadow]) o.dispose();
      renderer.dispose();
      renderer.forceContextLoss(); // 브라우저의 WebGL 컨텍스트 개수 제한에 걸리지 않게 바로 돌려준다
      canvas.remove();
    },
  };
}
