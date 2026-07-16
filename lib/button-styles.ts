import { cn } from "@/lib/utils"

/**
 * Styles de boutons verts dégradés pour l'application
 */
export const buttonVariants = {
  primary: "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg hover:shadow-xl transition-all duration-200",
  secondary: "bg-gradient-to-r from-green-100 to-green-200 hover:from-green-200 hover:to-green-300 text-green-700 dark:from-green-800 dark:to-green-900 dark:text-green-200 dark:hover:from-green-700 dark:hover:to-green-800 border border-green-300 dark:border-green-600",
  outline: "border-2 border-green-500 text-green-600 hover:bg-green-500 hover:text-white dark:border-green-400 dark:text-green-400 dark:hover:bg-green-400 dark:hover:text-white",
  ghost: "text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-800",
  destructive: "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
}

/**
 * Fonction utilitaire pour appliquer les styles de boutons verts
 */
export function getButtonStyles(variant: keyof typeof buttonVariants = 'primary', className?: string) {
  return cn(buttonVariants[variant], className)
}

/**
 * Classes CSS pour les boutons verts dégradés
 */
export const greenButtonClasses = {
  primary: "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 focus:ring-2 focus:ring-green-500 focus:ring-offset-2",
  secondary: "bg-gradient-to-r from-green-100 to-green-200 hover:from-green-200 hover:to-green-300 text-green-700 dark:from-green-800 dark:to-green-900 dark:text-green-200 dark:hover:from-green-700 dark:hover:to-green-800 border border-green-300 dark:border-green-600 shadow-sm hover:shadow-md transition-all duration-200",
  outline: "border-2 border-green-500 text-green-600 hover:bg-gradient-to-r hover:from-green-500 hover:to-green-600 hover:text-white dark:border-green-400 dark:text-green-400 dark:hover:bg-gradient-to-r dark:hover:from-green-400 dark:hover:to-green-500 dark:hover:text-white transition-all duration-200",
  ghost: "text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-800 transition-all duration-200",
  destructive: "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
}
