// Builds content/world/world.json: the overworld grid, the gyms, and the CMC buildings.
// Run: node scripts/make-world.mjs   (the JSON is the source of truth afterwards; edit it by hand if you like)
import { writeFileSync, mkdirSync } from 'node:fs'

const W = 48
const H = 36
const g = Array.from({ length: H }, () => Array.from({ length: W }, () => '.'))
const set = (x, y, ch) => {
  if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = ch
}
const rect = (x, y, w, h, ch) => {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, ch)
}

// Tree border.
rect(0, 0, W, 1, 'T')
rect(0, H - 1, W, 1, 'T')
rect(0, 0, 1, H, 'T')
rect(W - 1, 0, 1, H, 'T')

// Roads.
rect(23, 6, 2, 7, ',') // north trunk from CMC
rect(6, 6, 35, 2, ',') // north avenue
rect(4, 18, 13, 2, ',') // west road
rect(4, 15, 2, 11, ',') // west spur
rect(31, 18, 13, 2, ',') // east road
rect(42, 15, 2, 11, ',') // east spur
rect(23, 24, 2, 10, ',') // south trunk
rect(6, 33, 35, 1, ',') // south avenue

// CMC town: fenced, paved plaza, gaps for the four roads.
rect(16, 12, 16, 13, ',')
for (let x = 16; x < 32; x++) {
  set(x, 12, 'F')
  set(x, 24, 'F')
}
for (let y = 12; y < 25; y++) {
  set(16, y, 'F')
  set(31, y, 'F')
}
rect(23, 12, 2, 1, ',')
rect(23, 24, 2, 1, ',')
rect(16, 18, 1, 2, ',')
rect(31, 18, 1, 2, ',')
// flower beds
rect(18, 21, 3, 2, '*')

// Buildings: roof rows, wall rows, a door on the bottom wall.
const buildings = []
function building(id, x, y, w = 6, doorDx = 2) {
  rect(x, y, w, 2, 'R')
  rect(x, y + 2, w, 2, '#')
  const door = { x: x + doorDx, y: y + 3 }
  set(door.x, door.y, 'D')
  set(door.x, door.y + 1, ',')
  buildings.push({ id, x, y, w, h: 4, door })
  return door
}

// CMC hall (gym board) and the shop.
building('cmc-hall', 20, 13, 8, 3)
building('shop', 26, 19, 5, 2)

// Ten gyms around the region, in the order of the source document.
const gymSpots = {
  atls: [5, 2],
  acls: [21, 2],
  og: [37, 2],
  ot: [2, 11],
  medical: [2, 20],
  surgical: [40, 11],
  paedi: [40, 20],
  history: [5, 29],
  psychi: [21, 29],
  disaster: [37, 29],
}
for (const [id, [x, y]] of Object.entries(gymSpots)) building(id, x, y)

// Tall grass. Letters pick the question deck: a = ATLS, c = ACLS/PALS, o = O&G, x = mixed.
rect(8, 8, 9, 3, 'a')
rect(18, 8, 4, 3, 'c')
rect(26, 8, 5, 3, 'c')
rect(32, 8, 8, 3, 'o')
rect(44, 3, 2, 3, 'o')
rect(8, 25, 12, 4, 'x')
rect(27, 26, 3, 5, 'x')

// Pond, trees, flowers for texture.
rect(32, 25, 6, 4, '~')
for (const [x, y] of [[13, 13], [14, 14], [12, 22], [35, 13], [36, 14], [35, 22], [10, 16], [37, 16], [28, 30], [18, 30], [3, 3], [44, 30], [13, 3], [33, 3]]) set(x, y, 'T')
rect(8, 13, 3, 2, '*')
rect(36, 21, 3, 1, '*')

const rows = g.map((r) => r.join(''))

const gyms = [
  {
    id: 'atls',
    name: 'ATLS GYM',
    badge: 'Primary Survey Badge',
    packs: ['aw-em-01'],
    deck: 'atls',
    topics: ['Massive haemothorax', 'Pelvic fracture and binder', 'Clearing the C-spine', 'Intubation / RSI', 'Difficult airway, LMA', 'Thoracotomy', 'Burns and escharotomy', 'GCS, decerebrate and decorticate'],
  },
  {
    id: 'acls',
    name: 'ACLS/PALS GYM',
    badge: 'Rhythm Badge',
    packs: ['cv-em-02', 'io-em-01'],
    deck: 'acls',
    topics: ['VF and STEMI', 'VT and cocaine', 'Bradycardia and CHB', 'ROSC management', 'Paediatric septic shock', 'Paediatric wheeze', 'SVT', 'Neonatal resuscitation'],
  },
  {
    id: 'og',
    name: 'O&G GYM',
    badge: 'Delivery Badge',
    packs: ['gym-1'],
    deck: 'og',
    topics: ['PPH and placenta delivery', 'PV bleeding in early pregnancy', 'Eclampsia', 'Shoulder dystocia', 'Breech', 'Obstetric arrest', 'Bimanual pelvic exam'],
  },
  { id: 'ot', name: 'O&T GYM', badge: 'Joint Badge', packs: [], deck: null, topics: ['Knee exam', 'Hip exam', 'Shoulder dislocation', 'Shoulder impingement', 'Ankle and Ottawa rules', 'Hand, FDP/FDS', 'Colles', 'LS spine'] },
  { id: 'medical', name: 'MEDICAL GYM', badge: 'Physician Badge', packs: [], deck: null, topics: ['DKA', 'Addison disease', 'Anaemia', 'Chest pain', 'Dizziness', 'Cranial nerves', 'Cerebellar and Hallpike', 'Polyarthritis'] },
  { id: 'surgical', name: 'SURGICAL GYM', badge: 'Scalpel Badge', packs: [], deck: null, topics: ['Massive GI bleed', 'Renal stone', 'Epididymo-orchitis', 'Hepatosplenomegaly', 'Suturing', 'Digital nerve block', 'Venous cut-down'] },
  { id: 'paedi', name: 'PAEDI GYM', badge: 'Growth Badge', packs: [], deck: null, topics: ['Epiglottitis', 'Scarlet fever', 'Fever and rash', 'Paediatric vomiting', 'Paediatric seizure', 'Milestones', 'Limping child', 'NAI'] },
  { id: 'history', name: 'COUNSEL/HISTORY GYM', badge: 'Listener Badge', packs: [], deck: null, topics: ['Breaking bad news', 'Advance directive', 'Procedural sedation consent', 'DAMA', 'Needlestick injury', 'Returning traveller', 'Malaria'] },
  { id: 'psychi', name: 'PSYCHI GYM', badge: 'Mind Badge', packs: [], deck: null, topics: ['Mental state exam', 'Self-harm and SAD PERSONS', 'Manic patient', 'Psychosis history', 'Depression', 'Schizophrenia', 'Violent patient and restraint'] },
  { id: 'disaster', name: 'DISASTER/TRIAGE GYM', badge: 'Command Badge', packs: [], deck: null, topics: ['Field triage (START)', 'Triage of fire victims', 'Chlorine gas incident', 'Transfer', 'Planning and training', 'Crush syndrome'] },
]

for (const gym of gyms) gym.door = buildings.find((b) => b.id === gym.id).door

const world = {
  cols: W,
  rows: H,
  start: { x: 23, y: 20 },
  legend: {
    '.': 'grass',
    ',': 'path',
    T: 'tree',
    F: 'fence',
    '*': 'flowers',
    '~': 'water',
    R: 'roof',
    '#': 'wall',
    D: 'door',
    a: 'tall grass (ATLS deck)',
    c: 'tall grass (ACLS/PALS deck)',
    o: 'tall grass (O&G deck)',
    x: 'tall grass (mixed deck)',
  },
  grid: rows,
  buildings,
  gyms,
  places: [
    { id: 'cmc-hall', name: 'CMC HALL', kind: 'board', door: buildings.find((b) => b.id === 'cmc-hall').door },
    { id: 'shop', name: 'SHOP', kind: 'shop', door: buildings.find((b) => b.id === 'shop').door },
  ],
}

mkdirSync('content/world', { recursive: true })
writeFileSync('content/world/world.json', JSON.stringify(world, null, 2) + '\n')
console.log(rows.join('\n'))
