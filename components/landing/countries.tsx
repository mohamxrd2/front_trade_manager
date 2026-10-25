'use client'

import * as React from 'react'
import { m } from 'motion/react'

import { fadeUp, revealViewport, transitionBase } from '@/lib/motion'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

const COUNTRIES: { nameKey: string; flag: string }[] = [
  { nameKey: 'landing.countries.list.ci', flag: 'linear-gradient(90deg, #F77F00 33.3%, #FFFFFF 33.3% 66.6%, #009E60 66.6%)' },
  { nameKey: 'landing.countries.list.sn', flag: 'linear-gradient(90deg, #00853F 33.3%, #FDEF42 33.3% 66.6%, #E31B23 66.6%)' },
  { nameKey: 'landing.countries.list.ml', flag: 'linear-gradient(90deg, #14B53A 33.3%, #FCD116 33.3% 66.6%, #CE1126 66.6%)' },
  { nameKey: 'landing.countries.list.bf', flag: 'linear-gradient(180deg, #EF2B2D 50%, #009E49 50%)' },
  {
    nameKey: 'landing.countries.list.bj',
    flag: 'linear-gradient(90deg, #008751 40%, transparent 40%), linear-gradient(180deg, #FCD116 50%, #E8112D 50%)',
  },
  {
    nameKey: 'landing.countries.list.tg',
    flag:
      'linear-gradient(90deg, #D21034 38%, transparent 38%) top left / 100% 60% no-repeat, linear-gradient(180deg, #006A4E 20%, #FFCE00 20% 40%, #006A4E 40% 60%, #FFCE00 60% 80%, #006A4E 80%)',
  },
  { nameKey: 'landing.countries.list.ne', flag: 'linear-gradient(180deg, #E05206 33.3%, #FFFFFF 33.3% 66.6%, #0DB02B 66.6%)' },
  { nameKey: 'landing.countries.list.gn', flag: 'linear-gradient(90deg, #CE1126 33.3%, #FCD116 33.3% 66.6%, #009460 66.6%)' },
  { nameKey: 'landing.countries.list.cm', flag: 'linear-gradient(90deg, #007A5E 33.3%, #CE1126 33.3% 66.6%, #FCD116 66.6%)' },
  { nameKey: 'landing.countries.list.ga', flag: 'linear-gradient(180deg, #009E60 33.3%, #FCD116 33.3% 66.6%, #3A75C4 66.6%)' },
  { nameKey: 'landing.countries.list.cg', flag: 'linear-gradient(135deg, #009543 38%, #FBDE4A 38% 62%, #DC241F 62%)' },
  {
    nameKey: 'landing.countries.list.cd',
    flag: 'linear-gradient(150deg, #007FFF 42%, #F7D618 42% 45%, #CE1021 45% 57%, #F7D618 57% 60%, #007FFF 60%)',
  },
  { nameKey: 'landing.countries.list.td', flag: 'linear-gradient(90deg, #002664 33.3%, #FECB00 33.3% 66.6%, #C60C30 66.6%)' },
  {
    nameKey: 'landing.countries.list.mg',
    flag: 'linear-gradient(90deg, #FFFFFF 33.3%, transparent 33.3%), linear-gradient(180deg, #FC3D32 50%, #007E3A 50%)',
  },
  { nameKey: 'landing.countries.list.mr', flag: 'linear-gradient(180deg, #D01C1F 16%, #00A95C 16% 84%, #D01C1F 84%)' },
  { nameKey: 'landing.countries.list.ma', flag: 'radial-gradient(circle at 50% 50%, #006233 18%, transparent 20%), #C1272D' },
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
  const { t } = useTranslation()
  const [query, setQuery] = React.useState('')
  const nq = normalize(query)
  const results = nq ? COUNTRIES.filter((c) => normalize(t(c.nameKey)).includes(nq)) : COUNTRIES

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
          {t('landing.countries.title')}
        </h2>
        <p className="m-0 text-base leading-[1.55] text-[#6B6B7B]">
          {t('landing.countries.subtitle')}
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
          placeholder={t('landing.countries.searchPlaceholder')}
          aria-label={t('landing.countries.searchPlaceholder')}
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
            key={c.nameKey}
            className="flex items-center gap-2.5 rounded-2xl border border-[#ECECF2] bg-white px-3.5 py-3 text-sm font-semibold"
          >
            <span className="h-[17px] w-6 shrink-0 rounded" style={{ background: c.flag, boxShadow: '0 0 0 1px #E2E2EA' }} />
            {t(c.nameKey)}
          </span>
        ))}
      </m.div>

      {results.length === 0 ? (
        <p className="m-0 text-sm text-[#6B6B7B]">
          {t('landing.countries.noResults')}
        </p>
      ) : null}
    </section>
  )
}
