import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { SWRProvider } from "@/lib/providers/swr-provider";
import { QueryProvider } from "@/lib/providers/query-provider";
import { LanguageProvider } from "@/lib/i18n/context/LanguageContext";
import { Toaster } from "sonner";
import { NavigationProgressBar } from "@/components/navigation-progress-bar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trade Manager - Gestion Commerciale et Inventaire en Ligne | Logiciel de Gestion de Stock",
  description: "Trade Manager est une application web complète de gestion commerciale et d'inventaire. Gérez vos stocks, transactions, ventes et dépenses avec des analytics avancées, prédictions de réapprovisionnement et gestion multi-collaborateurs. Interface moderne et intuitive pour optimiser votre commerce.",
  keywords: "gestion de stock, gestion d'inventaire, logiciel commerce, gestion commerciale, analytics ventes, prédictions stock, gestion collaborateurs, application commerce, gestion transactions, inventaire en ligne",
  openGraph: {
    title: "Trade Manager - Gestion Commerciale et Inventaire",
    description: "Application web moderne pour gérer votre commerce, vos stocks et vos transactions avec des outils d'analytics avancés.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >

        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <SettingsProvider>
              <LanguageProvider>
                <SWRProvider>
                  <QueryProvider>
                    <NavigationProgressBar />
                    {children}
                    <Toaster position="bottom-right" richColors />
                  </QueryProvider>
                </SWRProvider>
              </LanguageProvider>
            </SettingsProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
