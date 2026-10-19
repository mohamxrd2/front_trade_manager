import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { LanguageProvider } from "@/lib/i18n/context/LanguageContext";
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

const SITE_DESCRIPTION =
  "Waelly gère votre stock, vos ventes et vos factures depuis une seule application, sur téléphone comme sur ordinateur.";

export const metadata: Metadata = {
  title: "Waelly — Gérez stock, ventes et factures de votre commerce",
  description: SITE_DESCRIPTION,
  keywords: "gestion de stock, gestion commerciale, factures PDF, ventes, dépenses, Afrique francophone, FCFA",
  openGraph: {
    title: "Waelly — Gérez stock, ventes et factures de votre commerce",
    description: SITE_DESCRIPTION,
    type: "website",
    locale: "fr_FR",
    siteName: "Waelly",
  },
  twitter: {
    card: "summary_large_image",
    title: "Waelly — Gérez stock, ventes et factures de votre commerce",
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#5B3FE6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
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
              <LanguageProvider>
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
