declare module 'virtual:station-index' {
  type Row = { id: string; gym?: string; title?: string; type?: string; time?: number }
  const index: { stations: (Row & { gym: string; title: string })[]; packs: Row[] }
  export default index
}

declare module 'virtual:station-cards' {
  type IndexCard = { q: string; options: string[]; why: string; source: string; note?: string }
  const cards: { id: string; gym: string; cards: IndexCard[] }[]
  export default cards
}
