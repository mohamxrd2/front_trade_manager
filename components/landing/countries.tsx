'use client'

import * as React from 'react'
import { m } from 'motion/react'

import { fadeUp, revealViewport, transitionBase } from '@/lib/motion'

const COUNTRIES: { name: string; flag: string }[] = [
  { name: 'Côte d’Ivoire', flag: 'linear-gradient(90deg, #F77F00 33.3%, #FFFFFF 33.3% 66.6%, #009E60 66.6%)' },
  { name: 'Sénégal', flag: 'linear-gradient(90deg, #00853F 33.3%, #FDEF42 33.3% 66.6%, #E31B23 66.6%)' },
  { name: 'Mali', flag: 'linear-gradient(90deg, #14B53A 33.3%, #FCD116 33.3% 66.6%, #CE1126 66.6%)' },
  { name: 'Burkina Faso', flag: 'linear-gradient(180deg, #EF2B2D 50%, #009E49 50%)' },
  {
    name: 'Bénin',
    flag: 'linear-gradient(90deg, #008751 40%, transparent 40%), linear-gradient(180deg, #FCD116 50%, #E8112D 50%)',
  },
  {
    name: 'Togo',
    flag:
      'linear-gradient(90deg, #D21034 38%, transparent 38%) top left / 100% 60% no-repeat, linear-gradient(180deg, #006A4E 20%, #FFCE00 20% 40%, #006A4E 40% 60%, #FFCE00 60% 80%, #006A4E 80%)',
  },
  { name: 'Niger', flag: 'linear-gradient(180deg, #E05206 33.3%, #FFFFFF 33.3% 66.6%, #0DB02B 66.6%)' },
  { name: 'Guinée', flag: 'linear-gradient(90deg, #CE1126 33.3%, #FCD116 33.3% 66.6%, #009460 66.6%)' },
  { name: 'Cameroun', flag: 'linear-gradient(90deg, #007A5E 33.3%, #CE1126 33.3% 66.6%, #FCD116 66.6%)' },
  { name: 'Gabon', flag: 'linear-gradient(180deg, #009E60 33.3%, #FCD116 33.3% 66.6%, #3A75C4 66.6%)' },
  { name: 'Congo', flag: 'linear-gradient(135deg, #009543 38%, #FBDE4A 38% 62%, #DC241F 62%)' },
  {
    name: 'RD Congo',
    flag: 'linear-gradient(150deg, #007FFF 42%, #F7D618 42% 45%, #CE1021 45% 57%, #F7D618 57% 60%, #007FFF 60%)',
  },
  { name: 'Tchad', flag: 'linear-gradient(90deg, #002664 33.3%, #FECB00 33.3% 66.6%, #C60C30 66.6%)' },
  {
    name: 'Madagascar',
    flag: 'linear-gradient(90deg, #FFFFFF 33.3%, transparent 33.3%), linear-gradient(180deg, #FC3D32 50%, #007E3A 50%)',
  },
  { name: 'Mauritanie', flag: 'linear-gradient(180deg, #D01C1F 16%, #00A95C 16% 84%, #D01C1F 84%)' },
  { name: 'Maroc', flag: 'radial-gradient(circle at 50% 50%, #006233 18%, transparent 20%), #C1272D' },
]

const COMBINING_MARKS_START = 0x0300
const COMBINING_MARKS_END = 0x036f
const DIACRITICS_RE = new RegExp(
  '[' + String.fromCharCode(COMBINING_MARKS_START) + '-' + String.fromCharCode(COMBINING_MARKS_END) + ']',
  'g'
)

function normalize(str: string) {
  return str.trim().toLowerCase().normalize('NFD').replace(DIACRITICS_RE, '')
}

export function Countries() {
  const [query, setQuery] = React.useState('')
  const nq = normalize(query)
  const results = nq ? COUNTRIES.filter((c) => normalize(c.name).includes(nq)) : COUNTRIES

  return (
    <section className="mx-auto flex max-w-[1180px] flex-col items-center gap-7 px-5 pt-[120px]">
      <m.div
        initial="hidden"
        whileInView="visible"
        viewport={revealViewport}
        variants={fadeUp}
        transition={transitionBase}
        className="flex max-w-[620px] flex-col items-center gap-3 text-center"
      >
        <h2 className="m-0 text-[clamp(30px,3.6vw,46px)] font-extrabold leading-[1.08] tracking-[-0.035em]">
          Pensé pour l&apos;Afrique francophone
        </h2>
        <p className="m-0 text-base leading-[1.55] text-[#6B6B7B]">
          FCFA, Mobile Money, factures en français : Waelly parle la langue de votre commerce, où que vous soyez.
        </p>
      </m.div>

      <m.label
        initial="hidden"
        whileInView="visible"
        viewport={revealViewport}
        variants={fadeUp}
        transition={transitionBase}
        className="flex h-[50px] w-full max-w-[420px] items-center gap-2.5 rounded-full border border-[#E2E2EA] bg-white px-4.5"
        style={{ boxShadow: '0 4px 14px rgba(17,17,80,.05)' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B6B7B" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher votre pays"
          aria-label="Rechercher votre pays"
          className="min-w-0 flex-1 border-0 bg-transparent font-sans text-[15px] text-[#0E0E1A] outline-none"
        />
      </m.label>

      <m.div
        initial="hidden"
        whileInView="visible"
        viewport={revealViewport}
        variants={fadeUp}
        transition={transitionBase}
        className="grid w-full grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2.5"
      >
        {results.map((c) => (
          <span
            key={c.name}
            className="flex items-center gap-2.5 rounded-2xl border border-[#ECECF2] bg-white px-3.5 py-3 text-sm font-semibold"
          >
            <span className="h-[17px] w-6 shrink-0 rounded" style={{ background: c.flag, boxShadow: '0 0 0 1px #E2E2EA' }} />
            {c.name}
          </span>
        ))}
      </m.div>

      {results.length === 0 ? (
        <p className="m-0 text-sm text-[#6B6B7B]">
          Votre pays n&apos;est pas listé ? Waelly fonctionne partout : choisissez simplement votre devise.
        </p>
      ) : null}
    </section>
  )
}
