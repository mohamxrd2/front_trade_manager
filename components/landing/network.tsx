'use client'

import { m } from 'motion/react'

import { fadeUp, revealViewport, transitionBase } from '@/lib/motion'

const CITIES = [
  { code: 'AD', name: 'Dakar', left: '14%', top: '45%', size: 40, bg: '#EEEAFE', color: '#4B2FD6', fontSize: 12 },
  { code: 'MD', name: 'Bamako', left: '33%', top: '42.5%', size: 40, bg: '#FFF0E0', color: '#8A4B00', fontSize: 12 },
  { code: 'FB', name: 'Conakry', left: '24%', top: '65%', size: 36, bg: '#E3F5EA', color: '#0B6B39', fontSize: 11 },
  { code: 'AK', name: 'Abidjan', left: '52%', top: '57.5%', size: 48, bg: null, color: '#FFFFFF', fontSize: 13 },
  { code: 'KY', name: 'Douala', left: '76%', top: '62.5%', size: 40, bg: '#E6EEFF', color: '#1F3FB8', fontSize: 12 },
]

export function Network() {
  return (
    <section className="mx-auto flex max-w-[1180px] flex-col items-center gap-6 px-5 pt-[120px]">
      <m.h2
        initial="hidden"
        whileInView="visible"
        viewport={revealViewport}
        variants={fadeUp}
        transition={transitionBase}
        className="m-0 text-center text-[clamp(30px,3.6vw,46px)] font-extrabold leading-[1.08] tracking-[-0.035em]"
      >
        De Dakar à Douala,
        <br />
        votre équipe reste connectée
      </m.h2>

      <m.div
        initial="hidden"
        whileInView="visible"
        viewport={revealViewport}
        variants={fadeUp}
        transition={transitionBase}
        aria-hidden="true"
        className="relative w-full"
        style={{ height: 'clamp(280px, 34vw, 420px)' }}
      >
        <div
          className="absolute inset-0 opacity-90"
          style={{
            backgroundImage: 'radial-gradient(circle, #B9AEF5 1.6px, transparent 1.9px)',
            backgroundSize: '15px 15px',
            maskImage:
              'radial-gradient(48% 62% at 40% 50%, #000 40%, transparent 72%), radial-gradient(26% 40% at 74% 58%, #000 35%, transparent 72%)',
            WebkitMaskImage:
              'radial-gradient(48% 62% at 40% 50%, #000 40%, transparent 72%), radial-gradient(26% 40% at 74% 58%, #000 35%, transparent 72%)',
          }}
        />
        <svg viewBox="0 0 1000 400" preserveAspectRatio="none" className="absolute inset-0 size-full">
          <path className="wl-arc" d="M140 180 Q 230 60 330 170" fill="none" stroke="#5B3FE6" strokeWidth="2.5" />
          <path className="wl-arc" d="M330 170 Q 420 40 520 230" fill="none" stroke="#5B3FE6" strokeWidth="2.5" />
          <path className="wl-arc" d="M520 230 Q 640 120 760 250" fill="none" stroke="#5B3FE6" strokeWidth="2.5" />
          <path className="wl-arc" d="M240 260 Q 380 330 520 230" fill="none" stroke="#8C74FF" strokeWidth="2" />
        </svg>

        {CITIES.map((city) => (
          <div key={city.code}>
            <span
              className="wl-pin absolute flex items-center justify-center rounded-full border-[3px] border-white font-extrabold"
              style={{
                left: city.left,
                top: city.top,
                width: city.size,
                height: city.size,
                transform: 'translate(-50%, -50%)',
                fontSize: city.fontSize,
                color: city.color,
                background:
                  city.bg ?? 'radial-gradient(100% 100% at 30% 20%, #8C74FF, #3420B8)',
              }}
            >
              {city.code}
            </span>
            <span
              className="absolute text-xs font-bold text-[#3A20B8]"
              style={{
                left: city.left,
                top: city.top,
                transform: `translate(-50%, ${city.size / 2 + 10}px)`,
              }}
            >
              {city.name}
            </span>
          </div>
        ))}
      </m.div>
    </section>
  )
}
