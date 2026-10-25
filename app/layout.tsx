import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { LanguageProvider } from "@/lib/i18n/context/LanguageContext";
import { LANGUAGE_COOKIE_NAME, type AppLanguage } from "@/lib/i18n/current-language";
import { Toaster } from "sonner";
import { Providers } from "@/app/providers";
import { StaleClientListener } from "@/components/stale-client-listener";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
});

const SITE_METADATA: Record<AppLanguage, { title: string; description: string; keywords: string }> = {
  fr: {
    title: "Waelly — Gérez stock, ventes et factures de votre commerce",
    description:
      "Waelly gère votre stock, vos ventes et vos factures depuis une seule application, sur téléphone comme sur ordinateur.",
    keywords: "gestion de stock, gestion commerciale, factures PDF, ventes, dépenses, Afrique francophone, FCFA",
  },
  en: {
    title: "Waelly — Manage your inventory, sales and invoices",
    description:
      "Waelly manages your inventory, sales and invoices from a single app, on phone and on computer.",
    keywords: "inventory management, business management, PDF invoices, sales, expenses, French-speaking Africa, FCFA",
  },
}

/** Même résolution que RootLayout (cookie, puis Accept-Language) — métadonnées ET premier rendu doivent toujours s'accorder. */
async function resolveInitialLanguage(): Promise<AppLanguage> {
  const cookieStore = await cookies()
  const cookieLanguage = cookieStore.get(LANGUAGE_COOKIE_NAME)?.value
  if (cookieLanguage === "en" || cookieLanguage === "fr") return cookieLanguage

  const acceptLanguage = (await headers()).get("accept-language") ?? ""
  return acceptLanguage.toLowerCase().startsWith("en") ? "en" : "fr"
}

export async function generateMetadata(): Promise<Metadata> {
  const language = await resolveInitialLanguage()
  const { title, description, keywords } = SITE_METADATA[language]

  return {
    title,
    description,
    keywords,
    openGraph: {
      title,
      description,
      type: "website",
      locale: language === "en" ? "en_US" : "fr_FR",
      siteName: "Waelly",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  }
}

export const viewport: Viewport = {
  themeColor: "#5B3FE6",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Lu une seule fois ici (Server Component) : le premier rendu — serveur
  // ET client à l'hydratation — affiche directement la bonne langue, sans
  // clignotement (<html lang> correct dès le départ, LanguageProvider
  // n'a pas besoin d'un état "mounted" transitoire différent du serveur).
  const initialLanguage = await resolveInitialLanguage();

  return (
    <html lang={initialLanguage} suppressHydrationWarning>
      <head>
        <script
          // Anti-FOUC : rendu une seule fois côté serveur (Server Component,
          // jamais re-rendu côté client), donc pas de warning React 19 sur
          // les <script> rencontrés pendant un rendu client.
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme')||'system';var r=t==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;var root=document.documentElement;if(r==='dark'){root.classList.add('dark');}root.style.colorScheme=r;}catch(e){}})();",
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${jakarta.variable} antialiased`}
      >

        <ThemeProvider>
          <AuthProvider>
            <SettingsProvider>
              <LanguageProvider initialLanguage={initialLanguage}>
                <Providers>
                  {children}
                  <Toaster position="bottom-right" richColors />
                  <StaleClientListener />
                </Providers>
              </LanguageProvider>
            </SettingsProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
