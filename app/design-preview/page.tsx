"use client"

/**
 * Page temporaire de démonstration des composants du système de design
 * Waelly (design/DESIGN.md § 6 à 9). À retirer une fois les écrans réels
 * migrés. Ne pas lier depuis la navigation de l'app.
 */

import * as React from "react"
import { ArrowDownLeft, ArrowUpRight, Plus } from "lucide-react"

import {
  AreaTrendChart,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CategoryDonut,
  FilterChips,
  GlassSidebar,
  HeroCard,
  KpiCard,
  SegmentedControl,
  StatusBadge,
  TransactionRow,
} from "@/components/waelly"
import { BottomTabBar } from "@/components/navigation/BottomTabBar"
import { AmountVisibilityProvider } from "@/contexts/AmountVisibilityContext"

const TREND_DATA = [
  { label: "Ven", value: 180_000 },
  { label: "Sam", value: 260_000 },
  { label: "Dim", value: 140_000 },
  { label: "Lun", value: 232_000 },
  { label: "Mar", value: 210_000 },
  { label: "Mer", value: 280_000 },
  { label: "Jeu", value: 312_000 },
]

const DONUT_DATA = [
  { label: "Robes & boubous", value: 46 },
  { label: "Tissus (wax, bazin)", value: 28 },
  { label: "Accessoires", value: 17 },
  { label: "Chemises", value: 9 },
]

export default function DesignPreviewPage() {
  const [chips, setChips] = React.useState("tous")
  const [period, setPeriod] = React.useState("30")

  return (
    <AmountVisibilityProvider>
    <div className="bg-desktop min-h-screen p-5">
      <div className="mx-auto flex max-w-[1480px] flex-wrap items-start gap-5">
        <div className="hidden lg:block lg:flex-[1_1_240px]">
          <GlassSidebar
            user={{ initials: "AK", name: "Awa Koné", company: "Awa Couture" }}
            stockAlerts={3}
            unreadNotifications={3}
          />
        </div>

        <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-6 pb-32">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-ink">
              Aperçu du design Waelly
            </h1>
            <p className="text-sm text-subtle">
              Page temporaire — tous les composants communs, hors pages réelles.
            </p>
          </div>

          <Card className="flex flex-col gap-4">
            <CardHeader>
              <CardTitle>Boutons</CardTitle>
            </CardHeader>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Principal</Button>
              <Button variant="black">Noir</Button>
              <Button variant="secondary">Secondaire</Button>
              <Button variant="danger">Supprimer</Button>
              <Button variant="round" size="round" aria-label="Ajouter">
                <Plus />
              </Button>
              <Button variant="round" size="round-lg" aria-label="Ajouter">
                <Plus />
              </Button>
            </div>
          </Card>

          <Card className="flex flex-col gap-4">
            <CardHeader>
              <CardTitle>Filtres &amp; contrôle segmenté</CardTitle>
            </CardHeader>
            <FilterChips
              value={chips}
              onChange={setChips}
              options={[
                { value: "tous", label: "Tous" },
                { value: "ventes", label: "Ventes" },
                { value: "depenses", label: "Dépenses" },
              ]}
            />
            <SegmentedControl
              value={period}
              onChange={setPeriod}
              options={[
                { value: "7", label: "7 jours" },
                { value: "30", label: "30 jours" },
                { value: "365", label: "12 mois" },
              ]}
            />
          </Card>

          <Card className="flex flex-col gap-3">
            <CardHeader>
              <CardTitle>Badges de statut</CardTitle>
            </CardHeader>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status="payee" />
              <StatusBadge status="envoyee" />
              <StatusBadge status="brouillon" />
              <StatusBadge status="stock-faible" />
              <StatusBadge status="disponible" />
            </div>
          </Card>

          <HeroCard
            label="Solde du mois"
            period="Octobre 2026"
            amount="1 245 000"
            progress={{
              label: "Objectif de ventes",
              current: "1 860 000",
              target: "2 500 000",
              percent: 74,
            }}
            actions={
              <>
                <Button variant="secondary" className="flex-1 bg-white">
                  <ArrowUpRight className="size-[17px]" />
                  Vente
                </Button>
                <Button variant="secondary" className="flex-1 bg-white">
                  <ArrowDownLeft className="size-[17px]" />
                  Dépense
                </Button>
                <Button variant="glass" className="flex-1 text-white">
                  Facture
                </Button>
              </>
            }
          />

          <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
            <KpiCard
              label="Chiffre d'affaires"
              value="1 860 000"
              delta="↑ 18 % vs mois préc."
              positive
              dotColor="#5B3FE6"
            />
            <KpiCard
              label="Dépenses"
              value="615 000"
              delta="↓ 3,2 %"
              positive
              dotColor="#E5484D"
            />
            <KpiCard
              label="Bénéfice net"
              value="1 245 000"
              delta="↑ 21 %"
              positive
              dotColor="#0B8A43"
            />
            <KpiCard
              label="Panier moyen"
              value="27 400"
              delta="↓ 2 %"
              positive={false}
              dotColor="#2B2BD9"
            />
          </div>

          <div className="flex flex-wrap gap-5">
            <Card className="flex-[2_1_480px]">
              <AreaTrendChart
                title="Tendance des ventes"
                trendPercent={18}
                data={TREND_DATA}
                actions={
                  <SegmentedControl
                    value={period}
                    onChange={setPeriod}
                    options={[
                      { value: "7", label: "7 jours" },
                      { value: "30", label: "30 jours" },
                    ]}
                  />
                }
              />
            </Card>
            <Card className="flex-[1_1_280px]">
              <CardHeader>
                <CardTitle>Ventes par catégorie</CardTitle>
              </CardHeader>
              <div className="mt-4">
                <CategoryDonut
                  data={DONUT_DATA}
                  centerValue="1,86 M"
                  centerLabel="FCFA ce mois"
                />
              </div>
            </Card>
          </div>

          <Card className="flex flex-col divide-y divide-divider p-0">
            <div className="p-5 pb-0">
              <CardTitle>Dernières opérations</CardTitle>
            </div>
            <TransactionRow
              icon={<ArrowUpRight className="size-5" strokeWidth={1.9} />}
              title="Robe wax · Taille M"
              meta="Vente · 14:32"
              amount="+25 000"
              type="income"
            />
            <TransactionRow
              icon={<ArrowDownLeft className="size-5" strokeWidth={1.9} />}
              title="Transport marchandises"
              meta="Dépense · 11:05"
              amount="−8 500"
              type="expense"
            />
            <TransactionRow
              icon={<ArrowUpRight className="size-5" strokeWidth={1.9} />}
              title="Sac en raphia ×2"
              meta="Vente · Facture F-0142"
              amount="+36 000"
              type="income"
            />
          </Card>
        </main>
      </div>

      <BottomTabBar />
    </div>
    </AmountVisibilityProvider>
  )
}
