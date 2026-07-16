import Image from 'next/image'

export default function ContentSection1() {
    return (
        <section className="py-16 md:py-32">
            <div className="mx-auto max-w-5xl space-y-8 px-6 md:space-y-16">
                <h2 className="relative z-10 max-w-xl text-4xl font-medium lg:text-5xl">Gestion Complète de vos Transactions</h2>
                <div className="grid gap-6 sm:grid-cols-2 md:gap-12 lg:gap-24">
                    <div className="relative mb-6 sm:mb-0">
                        <div className="bg-linear-to-b aspect-76/59 relative rounded-2xl from-zinc-300 to-transparent p-px dark:from-zinc-700">
                            <Image src="/payments.png" className="hidden rounded-[15px] dark:block" alt="Interface de gestion des transactions Trade Manager" width={1207} height={929} />
                            <Image src="/payments-light.png" className="rounded-[15px] shadow dark:hidden" alt="Interface de gestion des transactions Trade Manager" width={1207} height={929} />
                        </div>
                    </div>

                    <div className="relative space-y-4">
                        <p className="text-muted-foreground">
                            Enregistrez facilement vos <span className="text-accent-foreground font-bold">ventes et dépenses</span> avec une interface intuitive et des outils puissants de suivi financier.
                        </p>
                        <p className="text-muted-foreground">Suivez toutes vos transactions en temps réel, analysez vos revenus et dépenses, et gardez un contrôle total sur votre portefeuille commercial avec des statistiques détaillées et des graphiques interactifs.</p>

                        <div className="pt-6">
                            <blockquote className="border-l-4 pl-4">
                                <p>Trade Manager a transformé la façon dont je gère mon commerce. Les prédictions de réapprovisionnement m&apos;aident à éviter les ruptures de stock, et les analytics me permettent de prendre des décisions éclairées pour développer mon activité.</p>

                                <div className="mt-6 space-y-3">
                                    <cite className="block font-medium">Entrepreneur, Commerce de Détail</cite>
                                    <p className="text-sm text-muted-foreground">Solution recommandée pour les commerces modernes</p>
                                </div>
                            </blockquote>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
