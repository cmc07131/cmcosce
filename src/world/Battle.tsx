import { useEffect, useMemo, useRef, useState } from 'react'
import { useButtons } from '~/game/input'
import { Sprite } from '~/game/Sprite'
import { buzz, sfx } from '~/game/sfx'
import { NavItem, useCursor } from '~/game/ui'
import { creatureSprite } from './art'
import { pickCard, pickCreature, shuffled } from './encounter'
import type { Deck } from './model'
import { useProgress } from './progress'

type Phase = 'intro' | 'ask' | 'right' | 'wrong' | 'ran'

/** A wild creature asks one flashcard. Right answer: coins. Wrong: the answer and why. RUN always works. */
export function Battle({ deck, onClose }: { deck: Deck; onClose: () => void }) {
  const seen = useProgress((s) => s.seen)
  const coins = useProgress((s) => s.coins)
  const streak = useProgress((s) => s.streak)
  const answer = useProgress((s) => s.answer)
  const ran = useProgress((s) => s.ran)
  const creature = useMemo(() => pickCreature(deck, Math.random), [deck])
  const card = useMemo(() => pickCard(deck.cards, seen, Math.random), [deck])
  const { options, correct } = useMemo(() => shuffled(card, Math.random), [card])
  const [phase, setPhase] = useState<Phase>('intro')
  const [picked, setPicked] = useState<number | null>(null)
  const [earned, setEarned] = useState(0)
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    sfx.battle()
    const id = window.setTimeout(() => setPhase('ask'), 900)
    return () => window.clearTimeout(id)
  }, [])

  useCursor(menu, { priority: 40, enabled: phase === 'ask', onBack: () => run() })
  useButtons(40, phase === 'intro' || phase === 'right' || phase === 'wrong' || phase === 'ran', (btn) => {
    if (phase === 'intro') return
    if (btn === 'a' || btn === 'b') onClose()
  })

  function choose(i: number) {
    setPicked(i)
    const right = i === correct
    const got = answer(card.id, creature.id, right)
    setEarned(got)
    if (right) {
      sfx.mark()
      buzz(40)
      setPhase('right')
    } else {
      sfx.trap()
      buzz([30, 40, 30])
      setPhase('wrong')
    }
  }

  function run() {
    ran()
    sfx.back()
    setPhase('ran')
  }

  const done = phase === 'right' || phase === 'wrong' || phase === 'ran'
  return (
    <div className="battle-scene absolute inset-0 z-40 flex flex-col" data-testid="battle">
      {phase === 'intro' && <div className="battle-intro" aria-hidden />}
      <div className="battle-field">
        <div className="win battle-foe">
          <b>{creature.name}</b>
          <span>{deck.name.toUpperCase()}</span>
        </div>
        <div className="battle-foe-sprite" data-fainted={phase === 'right' || undefined} data-fled={phase === 'wrong' || phase === 'ran' || undefined}>
          <CreatureCanvas id={creature.id} draw={() => creatureSprite(creature)} />
        </div>
        <div className="battle-me">
          <Sprite role="doctor" facing="n" scale={4} />
        </div>
        <div className="win battle-purse">
          <b><i className="coin" />{coins}</b>
          <span>STREAK {streak}</span>
        </div>
      </div>

      <div className="win battle-text" data-testid="battle-text">
        {phase === 'intro' && <p>A wild {creature.name} appeared!</p>}
        {phase !== 'intro' && <p className="battle-q">{card.q}</p>}
        {phase === 'right' && (
          <p className="battle-result" data-tone="right">
            Correct! {creature.name} fainted. +{earned} coins. <span className="battle-why">{card.why}</span>
          </p>
        )}
        {phase === 'wrong' && (
          <p className="battle-result" data-tone="wrong">
            Not quite. The answer: <b>{options[correct]}</b>. <span className="battle-why">{card.why}</span> {creature.name} fled.
          </p>
        )}
        {phase === 'ran' && <p className="battle-result">Got away safely.</p>}
        {done && <p className="battle-source">Source: {card.source}</p>}
      </div>

      {phase === 'ask' && (
        <div ref={menu} className="win battle-moves" data-testid="battle-moves">
          {options.map((o, i) => (
            <NavItem key={o} testId={`answer-${i}`} onClick={() => choose(i)}>
              {o}
            </NavItem>
          ))}
          <NavItem testId="run" className="battle-run" onClick={run}>
            RUN
          </NavItem>
        </div>
      )}
      {done && (
        <button type="button" className="tap battle-continue" data-testid="battle-continue" onClick={onClose}>
          {picked !== null && picked === correct ? 'Onward ▶' : 'Back to the grass ▶'}
        </button>
      )}
    </div>
  )
}

function CreatureCanvas({ id, draw }: { id: string; draw: () => HTMLCanvasElement }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current?.getContext('2d')
    if (!c) return
    c.imageSmoothingEnabled = false
    c.clearRect(0, 0, 16, 16)
    c.drawImage(draw(), 0, 0)
  }, [id])
  return <canvas ref={ref} width={16} height={16} className="pixelated block h-full w-full" />
}
