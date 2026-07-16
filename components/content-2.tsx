import { Cpu, Zap } from 'lucide-react'
import Image from 'next/image'

export default function ContentSection() {
    return (
        <section className="py-16 md:py-32">
            <div className="mx-auto max-w-5xl space-y-8 px-6 md:space-y-16">
                <h2 className="relative z-10 max-w-xl text-4xl font-medium lg:text-5xl">Analytics et Statistiques en Temps Réel</h2>
                <div className="relative">
                    <div className="relative z-10 space-y-4 md:w-1/2">
                        <p>
                            Trade Manager vous offre <span className="font-medium">des outils d'analyse puissants</span> pour comprendre et optimiser vos performances commerciales.
                        </p>
                        <p>Visualisez l'évolution de vos ventes et dépenses, analysez vos tendances, identifiez vos meilleurs produits et recevez des prédictions intelligentes pour optimiser vos réapprovisionnements.</p>

                        <div className="grid grid-cols-2 gap-3 pt-6 sm:gap-4">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Zap className="size-4" />
                                    <h3 className="text-sm font-medium">Temps Réel</h3>
                                </div>
                                <p className="text-muted-foreground text-sm">Mise à jour automatique de vos données après chaque transaction pour un suivi en temps réel de vos performances.</p>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Cpu className="size-4" />
                                    <h3 className="text-sm font-medium">Prédictions IA</h3>
                                </div>
                                <p className="text-muted-foreground text-sm">Calculs automatiques de réapprovisionnement basés sur vos ventes moyennes pour éviter les ruptures de stock.</p>
                            </div>
                        </div>
                    </div>
                    <div className="md:mask-l-from-35% md:mask-l-to-55% mt-12 h-fit md:absolute md:-inset-y-12 md:inset-x-0 md:mt-0">
                        <div className="border-border/50 relative rounded-2xl border border-dotted p-2">
                            <Image
                                src="/charts.png"
                                className="hidden rounded-[12px] dark:block"
                                alt="Graphiques et analytics Trade Manager - Visualisation des ventes et dépenses"
                                width={1207}
                                height={929}
                            />
                           
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
