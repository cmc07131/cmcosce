/**
 * What an examiner has to hand: the tools, and what they can ask the patient to do. Pure data. Every station shows the
 * same core tools and the whole list of instructions: knowing which to use, where and when, is the examination.
 */

export type ToolDef = {
  id: string
  label: string
  icon: string
  /** `hold`: keep your finger down (deep palpation, a painful stimulus, listening, a capillary refill). */
  use: 'tap' | 'hold' | 'drag' | 'menu' | 'self'
  /** What it shows when nothing in this station's examination is found that way there. */
  normal: string
}

export const TOOLS: ToolDef[] = [
  { id: 'look', label: 'Look', icon: '👁', use: 'tap', normal: 'Nothing abnormal to see at {site}.' },
  { id: 'feel', label: 'Feel', icon: '✋', use: 'tap', normal: '{Site}: nothing abnormal to feel.' },
  { id: 'press', label: 'Press', icon: '👇', use: 'hold', normal: 'Firm pressure over {site}: no tenderness, nothing abnormal.' },
  { id: 'percuss', label: 'Percuss', icon: '🥁', use: 'tap', normal: 'Percussion over {site}: normal note.' },
  { id: 'listen', label: 'Listen', icon: '🩺', use: 'hold', normal: 'Nothing abnormal heard over {site}.' },
  { id: 'move', label: 'Move', icon: '🤲', use: 'drag', normal: 'Moves freely.' },
  { id: 'say', label: 'Ask', icon: '💬', use: 'menu', normal: '' },
  { id: 'gloves', label: 'Gloves', icon: '🧤', use: 'self', normal: 'Hands washed; gloves on.' },
  { id: 'torch', label: 'Pen torch', icon: '🔦', use: 'tap', normal: 'Nothing abnormal in the light.' },
  { id: 'ophthalmoscope', label: 'Ophthalmoscope', icon: '🔍', use: 'tap', normal: 'Nothing abnormal seen.' },
  { id: 'otoscope', label: 'Otoscope', icon: '👂', use: 'tap', normal: 'Nothing abnormal seen.' },
  { id: 'chart', label: 'Snellen chart', icon: '📋', use: 'tap', normal: 'Reads the chart.' },
  { id: 'pinhole', label: 'Pinhole', icon: '⚫', use: 'tap', normal: 'No change through the pinhole.' },
  { id: 'hammer', label: 'Tendon hammer', icon: '🔨', use: 'tap', normal: 'Normal reflex.' },
  { id: 'orange', label: 'Orange stick', icon: '🥢', use: 'tap', normal: 'Normal response.' },
  { id: 'pin', label: 'Neurotip', icon: '📍', use: 'tap', normal: 'Feels it normally at {site}.' },
  { id: 'cotton', label: 'Cotton wool', icon: '☁', use: 'tap', normal: 'Feels light touch normally at {site}.' },
  { id: 'calipers', label: 'Two-point calipers', icon: '📐', use: 'tap', normal: 'Two-point discrimination normal at {site}.' },
  { id: 'fork', label: 'Tuning fork', icon: '🎵', use: 'tap', normal: 'Hears it normally.' },
  { id: 'tape', label: 'Tape measure', icon: '📏', use: 'tap', normal: 'Measured.' },
  { id: 'doppler', label: 'Handheld Doppler', icon: '📡', use: 'hold', normal: 'Normal signal at {site}.' },
  { id: 'glucometer', label: 'Glucometer', icon: '🩸', use: 'tap', normal: 'Reading taken.' },
  { id: 'scanner', label: 'Bladder scanner', icon: '📟', use: 'hold', normal: 'Nothing to scan here.' },
  { id: 'speculum', label: 'Speculum', icon: '🦆', use: 'tap', normal: 'Not where a speculum goes.' },
  { id: 'swab', label: 'Swabs', icon: '🧪', use: 'tap', normal: 'Nothing to swab here.' },
]

export const toolById = (id: string) => TOOLS.find((t) => t.id === id)

/** Tools on every examination tray, whatever the station. */
export const CORE_TOOLS = ['look', 'feel', 'press', 'percuss', 'listen', 'move', 'say', 'gloves', 'torch', 'hammer', 'pin']

export type SayDef = {
  id: string
  label: string
  group: 'Position' | 'Talk' | 'Face and eyes' | 'Arms and hands' | 'Legs and walking'
  /** Left and right versions: the id gets -R / -L. */
  sided?: boolean
  /** What they do when nothing in this station makes it a finding. */
  reply: string
}

export const SAYS: SayDef[] = [
  // Position.
  { id: 'lie-flat', label: 'Lie flat for me', group: 'Position', reply: 'Lies flat.' },
  { id: 'sit-up', label: 'Sit up on the couch', group: 'Position', reply: 'Sits up.' },
  { id: 'sit-edge', label: 'Sit on the edge, facing me', group: 'Position', reply: 'Sits on the edge of the couch.' },
  { id: 'stand', label: 'Stand up', group: 'Position', reply: 'Stands.' },
  { id: 'roll', label: 'Roll onto your side', group: 'Position', sided: true, reply: 'Rolls over.' },
  { id: 'knees-up', label: 'Bend your knees, ankles together, let your knees fall apart', group: 'Position', reply: 'In position.' },
  { id: 'bend-forward', label: 'Bend forward and touch your toes', group: 'Position', reply: 'Bends forward.' },
  { id: 'walk', label: 'Walk across the room', group: 'Legs and walking', reply: 'Walks normally.' },
  { id: 'walk-heel-toe', label: 'Walk heel to toe', group: 'Legs and walking', reply: 'Walks heel to toe.' },
  { id: 'one-leg', label: 'Stand on one leg', group: 'Legs and walking', sided: true, reply: 'Stands on one leg; the pelvis stays level.' },
  { id: 'lift-leg', label: 'Lift your leg straight', group: 'Legs and walking', sided: true, reply: 'Lifts the leg straight.' },
  { id: 'bend-knee', label: 'Bend and straighten your knee', group: 'Legs and walking', sided: true, reply: 'Full range.' },
  { id: 'heel-shin', label: 'Run your heel down your other shin', group: 'Legs and walking', sided: true, reply: 'Smooth and accurate.' },
  { id: 'toes', label: 'Pull your toes up, push them down', group: 'Legs and walking', reply: 'Moves the toes and ankles normally.' },

  // Talk.
  { id: 'consent', label: 'Introduce yourself, explain, ask permission', group: 'Talk', reply: 'Agrees to the examination.' },
  { id: 'chaperone', label: 'Ask for a chaperone', group: 'Talk', reply: 'A nurse chaperone joins you.' },
  { id: 'analgesia', label: 'Offer pain relief', group: 'Talk', reply: 'Has had some; comfortable enough.' },
  { id: 'expose', label: 'Ask to expose the area, with a sheet', group: 'Talk', reply: 'Exposed, with a sheet for dignity.' },
  { id: 'open-eyes', label: 'Open your eyes!', group: 'Talk', reply: 'Opens the eyes.' },
  { id: 'orientation', label: 'What is your name, where are you, what month is it?', group: 'Talk', reply: 'Answers correctly.' },
  { id: 'say-phrase', label: "Say 'British constitution'", group: 'Talk', reply: 'Says it clearly.' },
  { id: 'deep-breath', label: 'Take a deep breath in', group: 'Talk', reply: 'Breathes in deeply.' },
  { id: 'cough', label: 'Give a cough', group: 'Talk', reply: 'Coughs.' },
  { id: 'whisper', label: 'Whisper a number in each ear', group: 'Talk', reply: 'Repeats the numbers.' },

  // Face and eyes.
  { id: 'follow-finger', label: 'Keep your head still, follow my finger', group: 'Face and eyes', reply: 'Full eye movements; no nystagmus, no double vision.' },
  { id: 'fields', label: 'Cover one eye; say when you see my finger', group: 'Face and eyes', reply: 'Full fields.' },
  { id: 'raise-eyebrows', label: 'Raise your eyebrows', group: 'Face and eyes', reply: 'Raises both eyebrows.' },
  { id: 'close-eyes', label: "Close your eyes tight; don't let me open them", group: 'Face and eyes', reply: 'Closes both eyes tightly.' },
  { id: 'show-teeth', label: 'Show me your teeth', group: 'Face and eyes', reply: 'A symmetrical smile.' },
  { id: 'puff-cheeks', label: 'Puff out your cheeks', group: 'Face and eyes', reply: 'Holds the air in.' },
  { id: 'open-mouth', label: "Open your mouth, say 'ah', stick out your tongue", group: 'Face and eyes', reply: 'Palate rises in the middle; tongue central.' },
  { id: 'clench-jaw', label: 'Clench your teeth', group: 'Face and eyes', reply: 'Masseters bulge equally.' },
  { id: 'shrug', label: 'Shrug your shoulders against me', group: 'Face and eyes', reply: 'Strong shrug.' },

  // Arms and hands.
  { id: 'squeeze-fingers', label: 'Squeeze my fingers, then let go', group: 'Arms and hands', reply: 'Squeezes and lets go.' },
  { id: 'arms-out', label: 'Arms out, palms up, eyes closed', group: 'Arms and hands', reply: 'No drift.' },
  { id: 'hands-out', label: 'Hold your hands out, cock your wrists back', group: 'Arms and hands', reply: 'No flap.' },
  { id: 'finger-nose', label: 'Touch my finger, then your nose', group: 'Arms and hands', sided: true, reply: 'Accurate, no tremor.' },
  { id: 'rapid-alternating', label: 'Pat your hand, front then back, fast', group: 'Arms and hands', reply: 'Quick and rhythmic.' },
  { id: 'raise-arm', label: 'Raise your arm out to the side', group: 'Arms and hands', sided: true, reply: 'Full, painless abduction.' },
  { id: 'push-out', label: 'Push your hand out against mine', group: 'Arms and hands', sided: true, reply: 'Strong.' },
  { id: 'lift-off', label: 'Hand behind your back; push it away from your back', group: 'Arms and hands', sided: true, reply: 'Lifts off strongly.' },
  { id: 'empty-can', label: 'Arms out, thumbs down; resist me pushing down', group: 'Arms and hands', sided: true, reply: 'Strong and painless.' },
  { id: 'wall-push', label: 'Push against the wall', group: 'Arms and hands', reply: 'No winging.' },
  { id: 'bend-fingertip', label: 'Hold the middle joint; bend just the fingertip', group: 'Arms and hands', reply: 'Bends the fingertip.' },
  { id: 'bend-finger', label: 'Hold the other fingers straight; bend this finger', group: 'Arms and hands', reply: 'Bends the finger.' },
  { id: 'thumbs-up', label: 'Thumbs up; bend your wrist back', group: 'Arms and hands', reply: 'Normal.' },
  { id: 'ok-sign', label: "Make an 'OK' sign", group: 'Arms and hands', reply: 'A round O.' },
  { id: 'cross-fingers', label: 'Cross your fingers; spread them against me', group: 'Arms and hands', reply: 'Normal.' },
  { id: 'opposition', label: 'Touch your thumb to your little finger', group: 'Arms and hands', reply: 'Normal opposition.' },
]

/** Every instruction id, with -R and -L for the sided ones. */
export const SAY_IDS: string[] = SAYS.flatMap((s) => (s.sided ? [`${s.id}-R`, `${s.id}-L`] : [s.id]))

export function sayOf(id: string): { def: SayDef; side: 'R' | 'L' | null } | null {
  const m = id.match(/^(.*)-(R|L)$/)
  const sided = m ? SAYS.find((s) => s.id === m[1] && s.sided) : undefined
  if (m && sided) return { def: sided, side: m[2] as 'R' | 'L' }
  const def = SAYS.find((s) => s.id === id)
  return def ? { def, side: null } : null
}
