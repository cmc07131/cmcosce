"""Ship a Microsoft Rocketbox avatar (MIT) for the web.

    python scripts/slim-rocketbox.py assets-src/rocketbox/Male_Adult_10 public/models/rb-m10

- Copies the facial-rig FBX as `<out>/patient.fbx` (it carries the face blendshapes the benches use).
- Its TGA textures become 1024 px WebP beside it, as the loader asks for them (`.tga` -> `.webp`).
- Specular maps are not used by the benches: a 4 px grey stand-in answers the FBX's reference to them.
- Copies Rocketbox's MIT notice alongside.
"""

import pathlib
import shutil
import sys

from PIL import Image


def main(src: str, dst: str):
    src_dir, out = pathlib.Path(src), pathlib.Path(dst)
    out.mkdir(parents=True, exist_ok=True)
    fbx = next(src_dir.glob('*_facial.fbx'))
    shutil.copyfile(fbx, out / 'patient.fbx')
    textures = sorted((src_dir / 'Textures').glob('*.tga'))
    prefix = textures[0].name.split('_')[0]
    for tga in textures:
        im = Image.open(tga)
        im = im.convert('RGBA' if 'opacity' in tga.name else 'RGB')
        if max(im.size) > 1024:
            im = im.resize((1024, 1024), Image.LANCZOS)
        im.save(out / (tga.stem + '.webp'), 'WEBP', quality=90 if 'normal' in tga.name else 85, method=6)
    for part in ('body', 'head'):
        Image.new('RGB', (4, 4), (90, 90, 90)).save(out / f'{prefix}_{part}_specular.webp', 'WEBP')
    # The MIT notice travels with every copy.
    shutil.copyfile(pathlib.Path(__file__).parent.parent / 'public/models/patient/LICENSE-Rocketbox.md', out / 'LICENSE-Rocketbox.md')
    size = sum(f.stat().st_size for f in out.iterdir())
    print(f'{out}: {size / 1e6:.1f} MB')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
