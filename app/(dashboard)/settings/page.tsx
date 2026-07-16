'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { useLanguage } from '@/lib/i18n/context/LanguageContext'
import { useSettings } from '@/contexts/SettingsContext'
import api from '@/lib/api'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Download,
  RotateCcw,
  Trash2,
  BookOpen,
  MessageSquare,
  HelpCircle,
  PlayCircle,
  AlertCircle,
  Settings as SettingsIcon,
  Check,
  Loader2,
} from 'lucide-react'
import { ModeToggle } from '@/components/modal-toggle'
import { getTransactionsForStats } from '@/lib/services/statistics'
import { type ApiTransaction } from '@/lib/services/transactions'
import { getArticles } from '@/lib/services/articles'
import { 
  exportToCSV, 
  exportToExcel, 
  formatTransactionsForExport, 
  formatProductsForExport 
} from '@/lib/utils/export'

interface SettingsState {
  // Interface
  language: string
  // Notifications
  emailNotifications: boolean
  notificationTypes: {
    sales: boolean
    lowStock: boolean
    transactions: boolean
  }
  pushNotifications: boolean
  // Fonctionnalités
  features: {
    analytics: boolean
    autoReports: boolean
  }
  // Affichage
  displaySettings: {
    tableDensity: string
    defaultChartType: string
  }
  // Seuils
  thresholds: {
    lowStock: number
    transactionLimit: number
  }
  // Devise
  currency: string
  // Sauvegarde
  autoSave: boolean
  saveFrequency: string
}

const defaultSettings: SettingsState = {
  language: 'fr',
  emailNotifications: false,
  notificationTypes: {
    sales: false,
    lowStock: false,
    transactions: false,
  },
  pushNotifications: false,
  features: {
    analytics: true,
    autoReports: false,
  },
  displaySettings: {
    tableDensity: 'normal',
    defaultChartType: 'line',
  },
  thresholds: {
    lowStock: 20,
    transactionLimit: 10000,
  },
  currency: 'FCFA',
  autoSave: false,
  saveFrequency: 'weekly',
}

// Fonction helper pour charger les paramètres depuis localStorage
const loadSettings = (): SettingsState => {
  if (typeof window === 'undefined') {
    return defaultSettings
  }
  
  const savedSettings = localStorage.getItem('app-settings')
  if (savedSettings) {
    try {
      const parsed = JSON.parse(savedSettings)
      return { ...defaultSettings, ...parsed }
    } catch (error) {
      console.error('Erreur lors du chargement des paramètres:', error)
    }
  }
  
  return defaultSettings
}

export default function SettingsPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const { language, setLanguage } = useLanguage()
  const { settings: apiSettings, loading: settingsLoading, updateSettings } = useSettings()
  const [settings, setSettings] = useState<SettingsState>(loadSettings)
  const [mounted] = useState(() => typeof window !== 'undefined')
  const [showResetSettingsDialog, setShowResetSettingsDialog] = useState(false)
  const [showResetDataDialog, setShowResetDataDialog] = useState(false)
  const [isResettingSettings, setIsResettingSettings] = useState(false)
  const [isResettingData, setIsResettingData] = useState(false)
  
  // État local pour le seuil de stock faible (avec bouton Enregistrer)
  const [localLowStockThreshold, setLocalLowStockThreshold] = useState<number>(80)
  const [isSavingThreshold, setIsSavingThreshold] = useState(false)
  const [hasThresholdChanges, setHasThresholdChanges] = useState(false)
  
  // État pour les exports
  const [isExporting, setIsExporting] = useState<string | null>(null)
  
  // Initialiser la valeur locale depuis les settings API
  useEffect(() => {
    if (apiSettings?.low_stock_threshold !== undefined) {
      setLocalLowStockThreshold(apiSettings.low_stock_threshold)
      setHasThresholdChanges(false)
    }
  }, [apiSettings?.low_stock_threshold])
  
  // Vérifier si des changements ont été faits pour le seuil
  useEffect(() => {
    if (apiSettings?.low_stock_threshold !== undefined) {
      const hasChanged = localLowStockThreshold !== apiSettings.low_stock_threshold
      setHasThresholdChanges(hasChanged)
    }
  }, [localLowStockThreshold, apiSettings?.low_stock_threshold])

  // Sauvegarder les paramètres dans localStorage
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('app-settings', JSON.stringify(settings))
    }
  }, [settings, mounted])

  // Handlers
  const handleEmailNotificationsChange = (checked: boolean) => {
    setSettings((prev) => ({
      ...prev,
      emailNotifications: checked,
      // Désactiver les types de notifications si on désactive les emails
      notificationTypes: checked
        ? prev.notificationTypes
        : {
            sales: false,
            lowStock: false,
            transactions: false,
          },
    }))
    toast.success(
      checked
        ? t('settings.notifications.emailEnabled')
        : t('settings.notifications.emailDisabled')
    )
  }

  const handleNotificationTypeChange = (type: string, checked: boolean) => {
    setSettings((prev) => ({
      ...prev,
      notificationTypes: {
        ...prev.notificationTypes,
        [type]: checked,
      },
    }))
  }

  const handlePushNotificationsChange = async (checked: boolean) => {
    if (checked && 'Notification' in window) {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        setSettings((prev) => ({
          ...prev,
          pushNotifications: true,
        }))
        toast.success(t('settings.notifications.pushEnabled'))
      } else {
        toast.error(t('settings.notifications.pushPermissionDenied'))
        return
      }
    } else {
      setSettings((prev) => ({
        ...prev,
        pushNotifications: false,
      }))
      toast.success(t('settings.notifications.pushDisabled'))
    }
  }

  const handleFeatureChange = (feature: string, checked: boolean) => {
    setSettings((prev) => ({
      ...prev,
      features: {
        ...prev.features,
        [feature]: checked,
      },
    }))
  }

  const handleDisplayChange = (key: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      displaySettings: {
        ...prev.displaySettings,
        [key]: value,
      },
    }))
  }

  const handleThresholdChange = (key: string, value: number) => {
    if (key === 'lowStock') {
      if (value < 0 || value > 100) {
        toast.error(t('settings.alerts.lowStockRangeError'))
        return
      }
      // Mettre à jour l'état local (ne pas sauvegarder automatiquement)
      setLocalLowStockThreshold(value)
    } else if (key === 'transactionLimit') {
      if (value < 0) {
        toast.error(t('settings.alerts.transactionLimitPositiveError'))
        return
      }
      setSettings((prev) => ({
        ...prev,
        thresholds: {
          ...prev.thresholds,
          [key]: value,
        },
      }))
    }
  }
  
  const handleSaveLowStockThreshold = async () => {
    setIsSavingThreshold(true)
    try {
      await updateSettings({ low_stock_threshold: localLowStockThreshold })
      setHasThresholdChanges(false)
    } catch (error) {
      // L'erreur est déjà gérée dans updateSettings
    } finally {
      setIsSavingThreshold(false)
    }
  }
  
  const handleResetLowStockThreshold = () => {
    if (apiSettings?.low_stock_threshold !== undefined) {
      setLocalLowStockThreshold(apiSettings.low_stock_threshold)
      setHasThresholdChanges(false)
    }
  }

  const handleLanguageChange = (value: 'fr' | 'en') => {
    setLanguage(value)
    setSettings((prev) => ({
      ...prev,
      language: value,
    }))
    toast.success(t('settings.appearance.languageChanged', { lang: value === 'fr' ? 'Français' : 'English' }))
  }

  const handleCurrencyChange = async (value: string) => {
    // Sauvegarder automatiquement
    try {
      await updateSettings({ currency: value })
    } catch (error) {
      // L'erreur est déjà gérée dans updateSettings
    }
  }

  const handleAutoSaveChange = (checked: boolean) => {
    setSettings((prev) => ({
      ...prev,
      autoSave: checked,
    }))
    toast.success(
      checked
        ? t('settings.backup.autoSaveEnabled')
        : t('settings.backup.autoSaveDisabled')
    )
  }

  const handleSaveFrequencyChange = (value: string) => {
    setSettings((prev) => ({
      ...prev,
      saveFrequency: value,
    }))
    const frequencyLabel = value === 'daily' 
      ? t('settings.backup.daily')
      : value === 'weekly'
      ? t('settings.backup.weekly')
      : t('settings.backup.monthly')
    toast.success(t('settings.backup.saveFrequencyChanged', { frequency: frequencyLabel }))
  }

  /**
   * Réinitialiser les réglages (remettre low_stock_threshold à 80)
   */
  const handleResetSettings = async () => {
    setIsResettingSettings(true)
    try {
      // Mettre à jour uniquement le low_stock_threshold à 80
      await updateSettings({
        low_stock_threshold: 80,
      })

      // Mettre à jour aussi la valeur locale
      setLocalLowStockThreshold(80)
      setHasThresholdChanges(false)

      toast.success(t('settings.reset.settingsResetSuccess'), {
        description: 'Le seuil de stock faible a été remis à 80%',
      })

      setShowResetSettingsDialog(false)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Impossible de réinitialiser les réglages'
      toast.error(t('common.error'), {
        description: errorMessage,
      })
    } finally {
      setIsResettingSettings(false)
    }
  }

  /**
   * Réinitialiser toutes les données (supprimer transactions et produits)
   */
  const handleResetData = async () => {
    setIsResettingData(true)
    try {
      toast.info('Suppression en cours...', {
        description: 'Récupération des données',
      })

      // Récupérer toutes les transactions
      const transactions = await fetchAllTransactions()

      // Récupérer tous les produits
      const products = await fetchAllProducts()

      if (transactions.length === 0 && products.length === 0) {
        toast.warning('Aucune donnée', {
          description: 'Aucune donnée à supprimer',
        })
        setShowResetDataDialog(false)
        return
      }

      toast.info('Suppression en cours...', {
        description: `Suppression de ${transactions.length} transaction(s) et ${products.length} produit(s)`,
      })

      // Supprimer toutes les transactions en parallèle (par lots de 10)
      const transactionBatches = []
      for (let i = 0; i < transactions.length; i += 10) {
        transactionBatches.push(
          Promise.all(
            transactions.slice(i, i + 10).map(transaction =>
              api.delete(`/api/transactions/${transaction.id}`)
            )
          )
        )
      }
      await Promise.all(transactionBatches)

      // Supprimer tous les produits en parallèle (par lots de 10)
      const articleBatches = []
      for (let i = 0; i < products.length; i += 10) {
        articleBatches.push(
          Promise.all(
            products.slice(i, i + 10).map(article =>
              api.delete(`/api/articles/${article.id}`)
            )
          )
        )
      }
      await Promise.all(articleBatches)

      toast.success(t('settings.reset.dataResetSuccess'), {
        description: `${transactions.length} transaction(s) et ${products.length} produit(s) supprimé(s)`,
      })

      setShowResetDataDialog(false)

      // Rafraîchir la page pour mettre à jour les données
      router.refresh()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t('settings.reset.resetError')
      toast.error(t('common.error'), {
        description: errorMessage,
      })
    } finally {
      setIsResettingData(false)
    }
  }

  /**
   * Récupère toutes les transactions depuis l'API
   */
  const fetchAllTransactions = async (): Promise<ApiTransaction[]> => {
    try {
      const transactions = await getTransactionsForStats()
      return transactions
    } catch (error) {
      console.error('Erreur lors de la récupération des transactions:', error)
      throw error
    }
  }

  /**
   * Récupère tous les produits depuis l'API
   */
  const fetchAllProducts = async () => {
    try {
      const products = await getArticles()
      return products
    } catch (error) {
      console.error('Erreur lors de la récupération des produits:', error)
      throw error
    }
  }

  /**
   * Exporte les transactions en CSV
   */
  const handleExportTransactionsCSV = async () => {
    setIsExporting('transactions-csv')
    try {
      toast.info('Export en cours...', {
        description: 'Récupération des transactions',
      })

      // Récupérer toutes les transactions
      const transactions = await fetchAllTransactions()

      if (transactions.length === 0) {
        toast.warning('Aucune donnée', {
          description: 'Aucune transaction à exporter',
        })
        return
      }

      // Formater les données
      const formattedData = formatTransactionsForExport(
        transactions,
        apiSettings?.currency || 'FCFA'
      )

      // Exporter en CSV
      exportToCSV(formattedData, `transactions_${new Date().toISOString().split('T')[0]}`)

      toast.success(t('settings.export.exportSuccess'), {
        description: `${transactions.length} transaction(s) exportée(s) en CSV`,
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t('settings.export.transactionsExportError')
      toast.error(t('common.error'), {
        description: errorMessage,
      })
    } finally {
      setIsExporting(null)
    }
  }

  /**
   * Exporte les transactions en Excel
   */
  const handleExportTransactionsExcel = async () => {
    setIsExporting('transactions-excel')
    try {
      toast.info('Export en cours...', {
        description: 'Récupération des transactions',
      })

      // Récupérer toutes les transactions
      const transactions = await fetchAllTransactions()

      if (transactions.length === 0) {
        toast.warning('Aucune donnée', {
          description: 'Aucune transaction à exporter',
        })
        return
      }

      // Formater les données
      const formattedData = formatTransactionsForExport(
        transactions,
        apiSettings?.currency || 'FCFA'
      )

      // Exporter en Excel
      exportToExcel(
        formattedData, 
        `transactions_${new Date().toISOString().split('T')[0]}`,
        'Transactions'
      )

      toast.success(t('settings.export.exportSuccess'), {
        description: `${transactions.length} transaction(s) exportée(s) en Excel`,
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t('settings.export.transactionsExportError')
      toast.error(t('common.error'), {
        description: errorMessage,
      })
    } finally {
      setIsExporting(null)
    }
  }

  /**
   * Exporte les produits en CSV
   */
  const handleExportProductsCSV = async () => {
    setIsExporting('products-csv')
    try {
      toast.info('Export en cours...', {
        description: 'Récupération des produits',
      })

      // Récupérer tous les produits
      const products = await fetchAllProducts()

      if (products.length === 0) {
        toast.warning('Aucune donnée', {
          description: 'Aucun produit à exporter',
        })
        return
      }

      // Formater les données
      const formattedData = formatProductsForExport(
        products, 
        apiSettings?.currency || 'FCFA'
      )

      // Exporter en CSV
      exportToCSV(formattedData, `produits_${new Date().toISOString().split('T')[0]}`)

      toast.success(t('settings.export.exportSuccess'), {
        description: `${products.length} produit(s) exporté(s) en CSV`,
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t('settings.export.productsExportError')
      toast.error(t('common.error'), {
        description: errorMessage,
      })
    } finally {
      setIsExporting(null)
    }
  }

  /**
   * Exporte les produits en Excel
   */
  const handleExportProductsExcel = async () => {
    setIsExporting('products-excel')
    try {
      toast.info('Export en cours...', {
        description: 'Récupération des produits',
      })

      // Récupérer tous les produits
      const products = await fetchAllProducts()

      if (products.length === 0) {
        toast.warning('Aucune donnée', {
          description: 'Aucun produit à exporter',
        })
        return
      }

      // Formater les données
      const formattedData = formatProductsForExport(
        products, 
        apiSettings?.currency || 'FCFA'
      )

      // Exporter en Excel
      exportToExcel(
        formattedData, 
        `produits_${new Date().toISOString().split('T')[0]}`,
        'Produits'
      )

      toast.success(t('settings.export.exportSuccess'), {
        description: `${products.length} produit(s) exporté(s) en Excel`,
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t('settings.export.productsExportError')
      toast.error(t('common.error'), {
        description: errorMessage,
      })
    } finally {
      setIsExporting(null)
    }
  }

  if (!mounted) {
    return (
      <div className="container mx-auto px-4 lg:px-6 py-6">
        <div className="space-y-6">
          <div>
            <div className="h-8 w-48 bg-muted animate-pulse rounded mb-2" />
            <div className="h-4 w-96 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 lg:px-6 py-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <SettingsIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{t('settings.title')}</h1>
          <p className="text-muted-foreground">
            {t('settings.description')}
          </p>
        </div>
      </div>

      {/* 1. PARAMÈTRES DE L'INTERFACE ET THÈME */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.appearance.title')}</CardTitle>
            <CardDescription>
              {t('settings.appearance.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('settings.appearance.darkMode')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('settings.appearance.darkModeDescription')}
                </p>
              </div>
              <ModeToggle />
            </div>
            <div className="text-sm text-muted-foreground">
              {t('settings.appearance.currentMode')}: <span className="font-medium">{theme || 'system'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('settings.appearance.language')}</CardTitle>
            <CardDescription>
              {t('settings.appearance.languageDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={language}
              onValueChange={handleLanguageChange}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('settings.appearance.language')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* 2. PARAMÈTRES DE NOTIFICATIONS */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.notifications.title')}</CardTitle>
            <CardDescription>
              {t('settings.notifications.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('settings.notifications.enable')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('settings.notifications.enableDescription')}
                </p>
              </div>
              <Switch
                checked={settings.emailNotifications}
                onCheckedChange={handleEmailNotificationsChange}
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <Label>{t('settings.notifications.types')}</Label>

              <div className="flex items-center justify-between">
                <Label htmlFor="notif-sales" className="font-normal">
                  {t('settings.notifications.sales')}
                </Label>
                <Switch
                  id="notif-sales"
                  checked={settings.notificationTypes.sales}
                  onCheckedChange={(checked) =>
                    handleNotificationTypeChange('sales', checked)
                  }
                  disabled={!settings.emailNotifications}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="notif-stock" className="font-normal">
                  {t('settings.notifications.lowStock')}
                </Label>
                <Switch
                  id="notif-stock"
                  checked={settings.notificationTypes.lowStock}
                  onCheckedChange={(checked) =>
                    handleNotificationTypeChange('lowStock', checked)
                  }
                  disabled={!settings.emailNotifications}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="notif-transactions" className="font-normal">
                  {t('settings.notifications.transactions')}
                </Label>
                <Switch
                  id="notif-transactions"
                  checked={settings.notificationTypes.transactions}
                  onCheckedChange={(checked) =>
                    handleNotificationTypeChange('transactions', checked)
                  }
                  disabled={!settings.emailNotifications}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('settings.notifications.pushNotifications')}</CardTitle>
            <CardDescription>
              {t('settings.notifications.pushNotificationsDescription2')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('settings.notifications.pushNotificationsEnable')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('settings.notifications.pushNotificationsEnableDescription')}
                </p>
              </div>
              <Switch
                checked={settings.pushNotifications}
                onCheckedChange={handlePushNotificationsChange}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. PARAMÈTRES D'APPLICATION / FONCTIONNALITÉS */}
      <div className="space-y-6">
        

        <Card>
          <CardHeader>
            <CardTitle>{t('settings.display.title')}</CardTitle>
            <CardDescription>
              {t('settings.display.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('settings.display.tableDensity')}</Label>
              <Select
                value={settings.displaySettings.tableDensity}
                onValueChange={(value) =>
                  handleDisplayChange('tableDensity', value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">{t('settings.display.compact')}</SelectItem>
                  <SelectItem value="normal">{t('settings.display.normal')}</SelectItem>
                  <SelectItem value="comfortable">{t('settings.display.comfortable')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('settings.display.defaultChartType')}</Label>
              <Select
                value={settings.displaySettings.defaultChartType}
                onValueChange={(value) =>
                  handleDisplayChange('defaultChartType', value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="line">{t('settings.display.line')}</SelectItem>
                  <SelectItem value="bar">{t('settings.display.bar')}</SelectItem>
                  <SelectItem value="area">{t('settings.display.area')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('settings.alerts.title')}</CardTitle>
            <CardDescription>
              {t('settings.alerts.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="low-stock-threshold">
                {t('settings.alerts.lowStockThreshold')}
              </Label>
              <Input
                id="low-stock-threshold"
                type="number"
                min="0"
                max="100"
                value={settingsLoading ? '' : localLowStockThreshold}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0
                  handleThresholdChange('lowStock', Math.min(100, Math.max(0, value)))
                }}
                disabled={settingsLoading}
              />
              <p className="text-sm text-muted-foreground">
                {t('settings.alerts.lowStockDescription')}
              </p>
            </div>
            
            {hasThresholdChanges && (
              <>
                <Separator />
                <div className="flex justify-end gap-4">
                  <Button
                    variant="outline"
                    onClick={handleResetLowStockThreshold}
                    disabled={isSavingThreshold || settingsLoading}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    onClick={handleSaveLowStockThreshold}
                    disabled={isSavingThreshold || settingsLoading}
                  >
                    {isSavingThreshold ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('common.saving')}
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        {t('common.save')}
                      </>
                    )}
                  </Button>
                </div>
                <div className="text-sm text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950 p-3 rounded-md">
                  ⚠️ {t('settings.unsavedChanges')}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('settings.currency.title')}</CardTitle>
            <CardDescription>
              {t('settings.currency.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currency">
                {t('settings.currency.title')} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={settingsLoading ? 'FCFA' : (apiSettings?.currency ?? 'FCFA')}
                onValueChange={handleCurrencyChange}
                disabled={settingsLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('settings.currency.selectCurrency')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FCFA">FCFA ({t('onboarding.settings.currencies.FCFA')})</SelectItem>
                  <SelectItem value="EUR">EUR ({t('onboarding.settings.currencies.EUR')})</SelectItem>
                  <SelectItem value="USD">USD ({t('onboarding.settings.currencies.USD')})</SelectItem>
                  <SelectItem value="GBP">GBP ({t('onboarding.settings.currencies.GBP')})</SelectItem>
                  <SelectItem value="JPY">JPY ({t('onboarding.settings.currencies.JPY')})</SelectItem>
                  <SelectItem value="CNY">CNY ({t('onboarding.settings.currencies.CNY')})</SelectItem>
                  <SelectItem value="INR">INR ({t('onboarding.settings.currencies.INR')})</SelectItem>
                  <SelectItem value="BRL">BRL ({t('onboarding.settings.currencies.BRL')})</SelectItem>
                  <SelectItem value="CAD">CAD ({t('onboarding.settings.currencies.CAD')})</SelectItem>
                  <SelectItem value="AUD">AUD ({t('onboarding.settings.currencies.AUD')})</SelectItem>
                  <SelectItem value="CHF">CHF ({t('onboarding.settings.currencies.CHF')})</SelectItem>
                  <SelectItem value="NGN">NGN ({t('onboarding.settings.currencies.NGN')})</SelectItem>
                  <SelectItem value="ZAR">ZAR ({t('onboarding.settings.currencies.ZAR')})</SelectItem>
                  <SelectItem value="EGP">EGP ({t('onboarding.settings.currencies.EGP')})</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {t('settings.currency.description')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. PARAMÈTRES DE SAUVEGARDE ET EXPORT */}
      <div className="space-y-6">
        

        <Card>
          <CardHeader>
            <CardTitle>{t('settings.export.title')}</CardTitle>
            <CardDescription>
              {t('settings.export.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('settings.export.exportTransactions')}</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={handleExportTransactionsCSV}
                  disabled={isExporting === 'transactions-csv'}
                >
                  {isExporting === 'transactions-csv' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Export...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      {t('settings.export.exportCSV')}
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportTransactionsExcel}
                  disabled={isExporting === 'transactions-excel'}
                >
                  {isExporting === 'transactions-excel' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Export...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      {t('settings.export.exportExcel')}
                    </>
                  )}
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>{t('settings.export.exportProducts')}</Label>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleExportProductsCSV}
                  disabled={isExporting === 'products-csv'}
                >
                  {isExporting === 'products-csv' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Export...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      {t('settings.export.exportCSV')}
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleExportProductsExcel}
                  disabled={isExporting === 'products-excel'}
                >
                  {isExporting === 'products-excel' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Export...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      {t('settings.export.exportExcel')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('settings.reset.title')}</CardTitle>
            <CardDescription>
              {t('settings.reset.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('settings.reset.warning')}</AlertTitle>
              <AlertDescription>
                {t('settings.reset.warningDescription')}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>{t('settings.reset.resetSettings')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.reset.resetSettingsDescription')}
              </p>
              <Button
                variant="outline"
                onClick={() => setShowResetSettingsDialog(true)}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {t('settings.reset.resetSettings')}
              </Button>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-destructive">{t('settings.reset.resetData')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.reset.resetDataDescription')}
              </p>
              <Button
                variant="destructive"
                onClick={() => setShowResetDataDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t('settings.reset.resetData')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 5. AIDE ET SUPPORT */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.support.title')}</CardTitle>
          <CardDescription>
            {t('settings.support.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => window.open('/docs', '_blank')}
          >
            <BookOpen className="mr-2 h-4 w-4" />
            {t('settings.support.documentation')}
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => window.open('/support', '_blank')}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            {t('settings.support.contact')}
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => window.open('/faq', '_blank')}
          >
            <HelpCircle className="mr-2 h-4 w-4" />
            {t('settings.support.faq')}
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => window.open('/tutorials', '_blank')}
          >
            <PlayCircle className="mr-2 h-4 w-4" />
            {t('settings.support.tutorials')}
          </Button>
        </CardContent>
      </Card>

      {/* Dialog de confirmation pour réinitialiser les paramètres */}
      <Dialog
        open={showResetSettingsDialog}
        onOpenChange={setShowResetSettingsDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.reset.resetSettings')}</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir réinitialiser les réglages ? Le seuil de stock faible sera remis à 80%.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowResetSettingsDialog(false)}
              disabled={isResettingSettings}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="default"
              onClick={handleResetSettings}
              disabled={isResettingSettings}
            >
              {isResettingSettings ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Réinitialisation...
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Confirmer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation pour réinitialiser les données */}
      <Dialog open={showResetDataDialog} onOpenChange={setShowResetDataDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">
              {t('settings.reset.resetData')}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                <p className="font-semibold text-destructive">
                  ⚠️ ATTENTION : Cette action est irréversible !
                </p>
                <p>
                  Vous êtes sur le point de supprimer :
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Toutes vos transactions (ventes et dépenses)</li>
                  <li>Tous vos produits (articles simples et variables)</li>
                  <li>Toutes les variations des articles variables</li>
                </ul>
                <p className="mt-2 font-semibold">
                  Cette action ne peut pas être annulée. Êtes-vous absolument sûr ?
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowResetDataDialog(false)}
              disabled={isResettingData}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetData}
              disabled={isResettingData}
            >
              {isResettingData ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Suppression...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer définitivement
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
