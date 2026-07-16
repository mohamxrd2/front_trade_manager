export default function StatsSection() {
    return (
        <section className="py-12 md:py-20">
            <div className="mx-auto max-w-5xl space-y-8 px-6 md:space-y-16">
                <div className="relative z-10 mx-auto max-w-xl space-y-6 text-center">
                    <h2 className="text-4xl font-semibold lg:text-5xl">Trade Manager en chiffres</h2>
                    <p>Une solution complète et moderne pour gérer efficacement votre commerce, avec des outils puissants d'analyse et de prédiction pour optimiser vos performances.</p>
                </div>

                <div className="grid gap-0.5 *:text-center md:grid-cols-3">
                    <div className="rounded-(--radius) space-y-4 border py-12">
                        <div className="text-5xl font-bold">100%</div>
                        <p>Gestion Automatisée</p>
                    </div>
                    <div className="rounded-(--radius) space-y-4 border py-12">
                        <div className="text-5xl font-bold">24/7</div>
                        <p>Disponibilité</p>
                    </div>
                    <div className="rounded-(--radius) space-y-4 border py-12">
                        <div className="text-5xl font-bold">0</div>
                        <p>Rupture de Stock</p>
                    </div>
                </div>
            </div>
        </section>
    )
}
