import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ANTALGIC_CYCLE, antalgic } from './gait'

test('antalgic gait: short stance on the sore leg, the knee held bent and stiff, a dip and a wince on it', () => {
  const samples = Array.from({ length: 200 }, (_, i) => antalgic((i / 200) * ANTALGIC_CYCLE, 'R'))
  const onGround = (side: 'R' | 'L') => samples.filter((g) => g.legs[side].stance).length / samples.length
  assert.ok(onGround('R') < 0.45 && onGround('L') > 0.75, `on the sore leg ${onGround('R')}, on the good ${onGround('L')}`)
  const knee = (side: 'R' | 'L') => samples.map((g) => g.legs[side].knee)
  assert.ok(Math.min(...knee('R')) >= 15, 'the sore knee never straightens')
  assert.ok(Math.max(...knee('R')) < Math.max(...knee('L')) - 15, 'and barely bends in the swing')
  assert.ok(Math.min(...knee('L')) < 8, 'the good knee straightens')
  // The dip and the wince come while the sore leg alone bears the weight.
  for (const g of samples) if (g.pain > 0.5) assert.ok(g.legs.R.stance && !g.legs.L.stance, 'it hurts standing on the sore leg alone')
})
