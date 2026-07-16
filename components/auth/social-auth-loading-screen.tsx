import { Loader2 } from 'lucide-react'

export function SocialAuthLoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        <p className="text-sm text-muted-foreground">Connexion en cours...</p>
      </div>
    </div>
  )
}
