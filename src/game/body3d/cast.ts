import { readCustomModel } from '../positional/customModel'
import { loadRocketbox, loadVrm, type Credit, type Rig } from './rig'

/**
 * Who plays the patient. The START menu's 3D PATIENT setting picks the look for adults: realistic, anime, or the
 * player's own model (from their device). The anime models and the player's own stand in for adults of their sex;
 * older patients and children are always realistic, so the case still fits.
 */

/** `custom`: the player's own VRM, kept on their device (see customModel.ts). */
export type AvatarId = 'realistic' | 'anime' | 'custom'
export type PatientKind = 'woman' | 'man' | 'elder' | 'boy'

const ROCKETBOX: Credit = { text: '3D avatar © Microsoft Rocketbox (MIT)', href: '/models/patient/LICENSE-Rocketbox.md' }

/** Microsoft Rocketbox avatars (MIT): Female_Adult_11, Male_Adult_10, Male_Adult_03, Male_Child_01. */
const REALISTIC: Record<PatientKind, string> = {
  woman: '/models/patient',
  man: '/models/rb-m10',
  elder: '/models/rb-m03',
  boy: '/models/rb-boy01',
}

/** pixiv's VRoid sample models (free for profit; not to be sold as files): AvatarSample_B and _C. */
const ANIME: Partial<Record<PatientKind, { url: string; credit: Credit }>> = {
  woman: { url: '/models/vroid-b/AvatarSample_B.vrm', credit: { text: '3D avatar: VRoid AvatarSample_B © pixiv', href: '/models/vroid-b/LICENSE-VRoid.md' } },
  man: { url: '/models/vroid-c/AvatarSample_C.vrm', credit: { text: '3D avatar: VRoid AvatarSample_C © pixiv', href: '/models/vroid-c/LICENSE-VRoid.md' } },
}

/** Load whoever plays this patient. The player's own model, missing or broken, gives way to the realistic one. */
export async function castPatient(kind: PatientKind, look: AvatarId): Promise<{ rig: Rig; credit: Credit }> {
  if (look === 'custom' && kind === 'woman') {
    const own = await readCustomModel()
    if (own) {
      const url = URL.createObjectURL(new Blob([own.bytes], { type: 'model/gltf-binary' }))
      try {
        return { rig: await loadVrm(url), credit: { text: own.credit } }
      } catch {
        // A file that will not load: the realistic patient stands in.
      } finally {
        URL.revokeObjectURL(url)
      }
    }
  }
  const anime = look === 'anime' ? ANIME[kind] : undefined
  if (anime) return { rig: await loadVrm(anime.url), credit: anime.credit }
  return { rig: await loadRocketbox(REALISTIC[kind]), credit: ROCKETBOX }
}

/** The kind of patient a station's cast describes: its role, or failing that the title before the name. */
export function patientKind(cast: { role?: string; name?: string } | undefined): PatientKind {
  const role = cast?.role ?? ''
  const name = cast?.name ?? ''
  if (role === 'child') return 'boy'
  if (role === 'elderly') return 'elder'
  if (role === 'woman') return 'woman'
  if (role === 'man') return 'man'
  return /^(Mrs|Ms|Miss|Madam)\b/.test(name) ? 'woman' : 'man'
}
