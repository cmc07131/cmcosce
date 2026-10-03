"""Slim a VRM (glTF binary) for the web without touching its rig, materials or expressions.

    python scripts/slim-vrm.py assets-src/vroid/AvatarSample_B.vrm public/models/vroid-b/AvatarSample_B.vrm

- Textures become WebP: colour maps at most 1024 px, normal maps 512 px, the thumbnail 64 px.
- Morph targets keep their positions and drop their normals (the toon shading barely shows them).
- Every node, accessor, material and texture keeps its index, so the VRM extension's references stay valid; only
  buffer views are compacted.
"""

import io
import json
import struct
import sys

from PIL import Image


def read_glb(path):
    data = open(path, 'rb').read()
    magic, version, _ = struct.unpack_from('<4sII', data, 0)
    assert magic == b'glTF' and version == 2, 'not a glTF 2 binary'
    jlen, jtype = struct.unpack_from('<I4s', data, 12)
    assert jtype == b'JSON'
    gltf = json.loads(data[20:20 + jlen])
    blen, btype = struct.unpack_from('<I4s', data, 20 + jlen)
    assert btype == b'BIN\0'
    return gltf, data[28 + jlen:28 + jlen + blen]


def write_glb(path, gltf, binary):
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    binary += b'\0' * (-len(binary) % 4)
    total = 12 + 8 + len(js) + 8 + len(binary)
    with open(path, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, total))
        f.write(struct.pack('<I4s', len(js), b'JSON') + js)
        f.write(struct.pack('<I4s', len(binary), b'BIN\0') + binary)


def view_bytes(gltf, binary, i):
    v = gltf['bufferViews'][i]
    o = v.get('byteOffset', 0)
    return binary[o:o + v['byteLength']]


def shrink(raw, name, thumb):
    img = Image.open(io.BytesIO(raw))
    img.load()
    cap = 64 if thumb else 512 if name.endswith('_nml') else 1024
    if max(img.size) > cap:
        k = cap / max(img.size)
        img = img.resize((max(1, round(img.width * k)), max(1, round(img.height * k))), Image.LANCZOS)
    if img.mode not in ('RGB', 'RGBA'):
        img = img.convert('RGBA' if 'A' in img.getbands() or 'transparency' in img.info else 'RGB')
    out = io.BytesIO()
    img.save(out, 'WEBP', quality=88, method=6)
    return out.getvalue()


def main(src, dst):
    gltf, binary = read_glb(src)
    vrm = gltf.get('extensions', {}).get('VRM', {})
    thumb = vrm.get('meta', {}).get('texture')
    thumb_image = gltf['textures'][thumb]['source'] if isinstance(thumb, int) and thumb >= 0 else None

    # Morph targets: positions only.
    for mesh in gltf['meshes']:
        for prim in mesh['primitives']:
            for t in prim.get('targets', []):
                t.pop('NORMAL', None)
                t.pop('TANGENT', None)

    # Which buffer views are still used, and by what.
    used_by_accessor = set()
    for mesh in gltf['meshes']:
        for prim in mesh['primitives']:
            refs = list(prim['attributes'].values()) + [a for t in prim.get('targets', []) for a in t.values()]
            if 'indices' in prim:
                refs.append(prim['indices'])
            for a in refs:
                used_by_accessor.add(a)
    for skin in gltf.get('skins', []):
        if 'inverseBindMatrices' in skin:
            used_by_accessor.add(skin['inverseBindMatrices'])
    for anim in gltf.get('animations', []):
        for s in anim['samplers']:
            used_by_accessor.update([s['input'], s['output']])

    new_views, new_bin, remap = [], bytearray(), {}

    def add_view(i, payload=None):
        if i in remap:
            return remap[i]
        v = dict(gltf['bufferViews'][i])
        payload = view_bytes(gltf, binary, i) if payload is None else payload
        new_bin.extend(b'\0' * (-len(new_bin) % 8))
        v['byteOffset'] = len(new_bin)
        v['byteLength'] = len(payload)
        new_bin.extend(payload)
        remap[i] = len(new_views)
        new_views.append(v)
        return remap[i]

    for ai, acc in enumerate(gltf['accessors']):
        if ai not in used_by_accessor:
            acc.pop('bufferView', None)
            acc.pop('byteOffset', None)
            continue
        if 'bufferView' in acc:
            acc['bufferView'] = add_view(acc['bufferView'])
        sparse = acc.get('sparse')
        if sparse:
            sparse['indices']['bufferView'] = add_view(sparse['indices']['bufferView'])
            sparse['values']['bufferView'] = add_view(sparse['values']['bufferView'])

    before = after = 0
    for ii, image in enumerate(gltf['images']):
        raw = view_bytes(gltf, binary, image['bufferView'])
        before += len(raw)
        slim = shrink(raw, image.get('name', ''), ii == thumb_image)
        if len(slim) >= len(raw) and ii != thumb_image:
            slim = raw
        else:
            image['mimeType'] = 'image/webp'
        after += len(slim)
        image['bufferView'] = add_image_view(new_views, new_bin, gltf['bufferViews'][image['bufferView']], slim)

    gltf['bufferViews'] = new_views
    gltf['buffers'] = [{'byteLength': len(new_bin)}]
    write_glb(dst, gltf, bytes(new_bin))
    print(f'images {before / 1e6:.1f} MB -> {after / 1e6:.1f} MB; file -> {(len(new_bin) + 2000) / 1e6:.1f} MB')


def add_image_view(new_views, new_bin, view, payload):
    v = {k: view[k] for k in view if k not in ('byteOffset', 'byteLength', 'byteStride', 'target')}
    new_bin.extend(b'\0' * (-len(new_bin) % 8))
    v['byteOffset'] = len(new_bin)
    v['byteLength'] = len(payload)
    new_bin.extend(payload)
    new_views.append(v)
    return len(new_views) - 1


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
