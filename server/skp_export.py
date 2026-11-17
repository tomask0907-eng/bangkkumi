# 배치를 실제 SketchUp 파일(.skp)로 만든다.
#   python skp_export.py            ← stdin으로 JSON(server/skp.js가 검증해서 만든 상자 목록)을 받는다
#   python skp_export.py --inspect <파일.skp>   ← 저장한 파일을 다시 읽어 범위·그룹을 확인(개발용)
# 좌표: 입력은 방 좌표 cm(평면 x, y, 높이). SketchUp은 mm, z가 위.
#       x → X, y → (방 깊이 - y) 로 뒤집어서, SketchUp에서 위에서 본 모습이 평면도와 같게 한다.
import sys, json, math, re
from pathlib import Path

HERE = Path(__file__).resolve().parent
EXPORTS = HERE.parent / 'exports'
SAFE_NAME = re.compile(r'^bangkkumi-[0-9a-z-]{1,40}\.skp$')  # 저장 이름은 서버가 만든 형식만 받는다


def hex_rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def export(data):
    import su_api as su
    room = data['room']
    W, D, H, T = room['width'], room['depth'], room['height'], data['T']
    if not SAFE_NAME.match(data['out']):
        raise ValueError('bad output name')
    EXPORTS.mkdir(exist_ok=True)
    out = EXPORTS / data['out']

    def pt(x, y, h):
        return (x * 10.0, (D - y) * 10.0, h * 10.0)

    m = su.Model('bangkkumi')
    names = data.get('matNames', {})

    def mat(c, opacity=1):
        name = names.get(c, c) + ('' if opacity >= 1 else ' (유리)')
        m.material(name, hex_rgb(c), opacity)
        return name

    def round_part(mesh, b, k0, k1, n=16):
        # 원통·원뿔대. k0, k1 = 아래·위 반지름 비율. cylf는 옆으로 누운 원통(축 = 평면 x 또는 y)
        cx, cy, cz = (b['x0'] + b['x1']) / 2, (b['y0'] + b['y1']) / 2, (b['b'] + b['t']) / 2
        rx, ry, rz = (b['x1'] - b['x0']) / 2, (b['y1'] - b['y0']) / 2, (b['t'] - b['b']) / 2
        ax = b.get('ax') if b['s'] == 'cylf' else 'z'

        def ring(end, k):
            out_ = []
            for i in range(n):
                c, s = math.cos(i * 2 * math.pi / n) * k, math.sin(i * 2 * math.pi / n) * k
                if ax == 'z':
                    out_.append(pt(cx + rx * c, cy + ry * s, cz + rz * end))
                elif ax == 'x':
                    out_.append(pt(cx + rx * end, cy + ry * c, cz + rz * s))
                else:
                    out_.append(pt(cx + rx * c, cy + ry * end, cz + rz * s))
            return out_
        lo, hi = ring(-1, k0), ring(1, k1)
        mesh.face(lo)
        mesh.face(hi)
        for i in range(n):
            j = (i + 1) % n
            mesh.face([lo[i], lo[j], hi[j], hi[i]])

    def ball(mesh, b, n=10, rings=5):
        cx, cy, cz = (b['x0'] + b['x1']) / 2, (b['y0'] + b['y1']) / 2, (b['b'] + b['t']) / 2
        rx, ry, rz = (b['x1'] - b['x0']) / 2, (b['y1'] - b['y0']) / 2, (b['t'] - b['b']) / 2

        def p(i, j):
            a, v = i * 2 * math.pi / n, j * math.pi / rings
            return pt(cx + rx * math.sin(v) * math.cos(a), cy + ry * math.sin(v) * math.sin(a), cz + rz * math.cos(v))
        for j in range(rings):
            for i in range(n):
                mesh.face([p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)])

    def draw(root, boxes, polys=()):
        for b in boxes:
            if b.get('wall'):
                continue  # 벽 몸통은 아래에서 구멍 뚫린 한 덩어리로 만든다
            mesh = m.mesh(root, '부품', mat(b['c'], b.get('o', 1)))
            s = b['s']
            if s in ('cyl', 'cylf'):
                round_part(mesh, b, 1, 1)
            elif s == 'shade':
                round_part(mesh, b, 1, 0.6)
            elif s == 'pot':
                round_part(mesh, b, 0.72, 1)
            elif s == 'sph':
                ball(mesh, b)
            else:
                x0, y0, _ = pt(b['x0'], b['y1'], 0)
                x1, y1, _ = pt(b['x1'], b['y0'], 0)
                mesh.box([x0, y0, x1, y1, b['b'] * 10.0, b['t'] * 10.0])
        for q in polys:
            m.mesh(root, '부품', mat(q['c'])).prism([pt(x, y, 0)[:2] for x, y in q['pts']], q['b'] * 10.0, q['t'] * 10.0)

    # 바닥판
    x0, y0, _ = pt(-T, D + T, 0)
    x1, y1, _ = pt(W + T, -T, 0)
    m.mesh('바닥', '바닥판', mat(data['colors']['floor'])).box([x0, y0, x1, y1, -100.0, 0.0])

    # 벽: 두께 T의 한 덩어리. 문(바닥까지 내려오는 구멍)은 바깥선을 파고, 창문은 안쪽 고리로 뚫는다.
    for w in data['walls']:
        side = w['wall']
        ext = T if side in ('top', 'bottom') else 0
        u0, u1 = -ext, w['len'] + ext

        def to3d(u, h, t, side=side):
            if side == 'top':
                return pt(u, -t, h)
            if side == 'bottom':
                return pt(u, D + t, h)
            if side == 'left':
                return pt(-t, u, h)
            return pt(W + t, u, h)
        chain, holes = [(u0, 0)], []
        for o in w['ops']:
            if o['h0'] < 1:
                if o['u0'] <= u0 + 0.01:
                    chain = []  # 벽 끝에서 시작하는 문: 모서리 점을 빼야 선이 겹치지 않는다
                else:
                    chain += [(o['u0'], 0)]
                chain += [(max(o['u0'], u0), o['h1']), (min(o['u1'], u1), o['h1'])]
                if o['u1'] < u1 - 0.01:
                    chain += [(o['u1'], 0)]
            else:
                a, b = max(o['u0'], u0 + 1), min(o['u1'], u1 - 1)  # 구멍이 벽 끝에 닿으면 면을 만들 수 없다
                holes.append([(a, o['h0']), (b, o['h0']), (b, o['h1']), (a, o['h1'])])
        if not (chain[-1][1] != 0 and chain[-1][0] >= u1 - 0.01):  # 마지막 문이 벽 끝까지 가지 않았으면 바닥 모서리를 넣는다
            chain.append((u1, 0))
        outer = chain + [(u1, H), (u0, H)]
        mesh = m.mesh(w['name'], '벽체', mat(data['colors']['wall']))
        for t in (0, T):
            mesh.face([to3d(u, h, t) for u, h in outer], [[to3d(u, h, t) for u, h in hole] for hole in holes])
        for loop in [outer] + holes:
            for a, b in zip(loop, loop[1:] + loop[:1]):
                mesh.face([to3d(*a, 0), to3d(*b, 0), to3d(*b, T), to3d(*a, T)])
        draw(w['name'], w['boxes'], w['polys'])

    for it in data['items']:
        draw(it['name'], it['boxes'])
    m.build()

    cam = data['camera']
    everything = set(m.roots)
    m.scene('조감', everything - set(cam['hide']), pt(*cam['eye']), pt(*cam['target']), fov=40)
    top_h = max(D + 2 * T + 60, (W + 2 * T + 60) / 1.4) * 10.0  # 화면 비율을 모르니 넉넉하게
    m.scene('평면', everything, pt(W / 2, D / 2, H + 1000), pt(W / 2, D / 2, 0), height=top_h, up=(0, 1, 0))
    report = m.save(out)
    return {'ok': True, 'file': data['out'], 'bounds_mm': report['bounds_mm'], 'groups': report['roots'], 'scenes': report['scenes'], 'materials': report['materials']}


def inspect(path):
    import ctypes as C
    import su_api as su
    model, status = su.Ref(), su.I()
    su.check('SUModelCreateFromFileWithStatus', C.byref(model), su.enc(Path(path).resolve()), C.byref(status))
    ents = su.new('SUModelGetEntities', model)
    n = su.get_count('SUEntitiesGetNumGroups', ents)
    groups = (su.Ref * n)()
    got = su.S()
    su.check('SUEntitiesGetGroups', ents, n, groups, C.byref(got))
    out = {
        'bounds_mm': [[round(v, 1) for v in p] for p in su.bbox(ents)],
        'groups': [su.read_string('SUGroupGetName', groups[i]) for i in range(got.value)],
        'top_level_faces': su.get_count('SUEntitiesGetNumFaces', ents),
        'scenes': su.get_count('SUModelGetNumScenes', model),
        'materials': su.get_count('SUModelGetNumMaterials', model),
    }
    out['group_bounds_mm'] = {
        name: [[round(v, 1) for v in p] for p in su.bbox(su.new('SUGroupGetEntities', groups[i]))]
        for i, name in enumerate(out['groups'])
    }
    su.check('SUModelRelease', C.byref(model))
    return out


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    try:
        if len(sys.argv) == 3 and sys.argv[1] == '--inspect':
            result = inspect(sys.argv[2])
        else:
            result = export(json.loads(sys.stdin.buffer.read().decode('utf-8')))
    except Exception as e:  # 오류도 JSON 한 줄로 알려서 서버가 읽을 수 있게 한다
        print(json.dumps({'ok': False, 'error': f'{type(e).__name__}: {e}'}, ensure_ascii=False))
        sys.exit(1)
    print(json.dumps(result, ensure_ascii=False))
