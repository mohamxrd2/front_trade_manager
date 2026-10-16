'use client'

import * as React from 'react'
import { AnimatePresence, m } from 'motion/react'

import { EASE, fadeUp, revealViewport, transitionBase } from '@/lib/motion'
import { cn } from '@/lib/utils'

type TabId = 'general' | 'factures' | 'compte'

const TABS: { id: TabId; label: string }[] = [
  { id: 'general', label: 'Général' },
  { id: 'factures', label: 'Factures' },
  { id: 'compte', label: 'Compte' },
]

const FAQ_DATA: Record<TabId, { q: string; a: string }[]> = {
  general: [
    {
      q: 'Puis-je utiliser Waelly sur mon téléphone ?',
      a: 'Oui. Waelly fonctionne sur téléphone et sur ordinateur, avec le même compte et les mêmes données, mises à jour en temps réel.',
    },
    {
      q: 'Faut-il une connexion internet ?',
      a: 'Une connexion est nécessaire pour enregistrer et synchroniser vos opérations. Les pages déjà ouvertes restent consultables.',
    },
    {
      q: 'Quelle devise est utilisée ?',
      a: 'Le FCFA par défaut. Vous pouvez choisir une autre devise dans les paramètres, ainsi que la langue et le seuil de stock faible.',
    },
    {
      q: 'Mes données sont-elles en sécurité ?',
      a: 'Vos données sont chiffrées pendant leur transfert et sauvegardées. Vous seul et les collaborateurs que vous invitez y avez accès.',
    },
  ],
  factures: [
    {
      q: 'Puis-je personnaliser mes factures ?',
      a: 'Oui : logo, informations légales et bancaires, thème visuel, remises, taxes et frais de port.',
    },
    {
      q: 'Comment envoyer une facture à un client ?',
      a: 'Téléchargez le PDF ou partagez-le directement, puis suivez son statut : brouillon, envoyée, payée.',
    },
    {
      q: 'Une facture payée crée-t-elle une vente ?',
      a: 'Oui. Quand une facture passe en payée, la vente et le stock sont mis à jour automatiquement.',
    },
    {
      q: 'Puis-je facturer des services sans stock ?',
      a: 'Oui, ajoutez des lignes libres à côté des articles de votre stock.',
    },
  ],
  compte: [
    {
      q: 'Comment créer mon compte ?',
      a: 'Par e-mail avec un code de vérification, ou en un clic avec Google ou Facebook.',
    },
    {
      q: 'Mon équipe peut-elle utiliser le même compte ?',
      a: 'Ajoutez vos collaborateurs avec leur rôle, leur part et leurs coordonnées.',
    },
    {
      q: 'Puis-je changer d’offre à tout moment ?',
      a: 'Oui, vous pouvez passer d’une offre à l’autre quand vous le souhaitez.',
    },
    {
      q: 'Comment supprimer mon compte ?',
      a: 'Depuis Paramètres > Sécurité. La suppression efface définitivement vos données.',
    },
  ],
}

export function Faq() {
  const [tab, setTab] = React.useState<TabId>('general')
  const [openIndex, setOpenIndex] = React.useState(0)

  const faqs = FAQ_DATA[tab]

  return (
    <section id="faq" className="mx-auto flex max-w-[820px] scroll-mt-24 flex-col items-center gap-6 px-5 pt-[120px]">
      <m.div
        initial="hidden"
        whileInView="visible"
        viewport={revealViewport}
        variants={fadeUp}
        transition={transitionBase}
        className="flex flex-col items-center gap-3 text-center"
      >
        <h2 className="m-0 text-[clamp(30px,3.6vw,46px)] font-extrabold leading-[1.08] tracking-[-0.035em]">
          Des questions ?
          <br />
          Nous avons les réponses.
        </h2>
        <p className="m-0 text-base text-[#6B6B7B]">Tout ce qu&apos;il faut savoir avant de vous lancer.</p>
      </m.div>

      <m.div
        initial="hidden"
        whileInView="visible"
        viewport={revealViewport}
        variants={fadeUp}
        transition={transitionBase}
        role="tablist"
        aria-label="Thèmes"
        className="flex flex-wrap justify-center gap-1 rounded-[26px] bg-[#F1EFFA] p-1"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id)
              setOpenIndex(0)
            }}
            className={cn(
              'min-h-[42px] cursor-pointer rounded-full border-0 px-5 font-sans text-sm font-semibold',
              tab === t.id ? 'bg-[#5B3FE6] text-white font-bold' : 'bg-transparent text-[#4B4B5C]'
            )}
          >
            {t.label}
          </button>
        ))}
      </m.div>

      <div className="flex w-full flex-col gap-2.5">
        {faqs.map((item, i) => {
          const open = i === openIndex
          return (
            <div
              key={item.q}
              className={cn(
                'overflow-hidden rounded-[20px] border transition-colors duration-250',
                open ? 'border-[#DCD4FF] bg-[#F4F1FF]' : 'border-[#ECECF2] bg-white'
              )}
            >
              <button
                type="button"
                onClick={() => setOpenIndex(open ? -1 : i)}
                aria-expanded={open}
                className="flex min-h-[60px] w-full cursor-pointer items-center justify-between gap-4 border-0 bg-transparent px-5 text-left font-sans text-[15px] font-bold text-[#0E0E1A]"
              >
                {item.q}
                <span
                  className={cn(
                    'flex size-[30px] shrink-0 items-center justify-center rounded-full text-lg font-semibold transition-transform duration-250',
                    open ? 'rotate-45 bg-[#5B3FE6] text-white' : 'bg-[#F3F3F7] text-[#0E0E1A]'
                  )}
                >
                  +
                </span>
              </button>
              <AnimatePresence initial={false}>
                {open ? (
                  <m.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                  >
                    <p className="m-0 px-5 pb-4.5 text-sm leading-[1.6] text-[#4B4B5C]">{item.a}</p>
                  </m.div>
                ) : null}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </section>
  )
}
