'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { getCollaborators, getCollaboratorById, deleteCollaborator, type Collaborator } from '@/lib/services/collaborators'
import { getUser, type User } from '@/lib/auth'
import { Plus, Pencil, Trash2, User as UserIcon } from 'lucide-react'
import { useTranslation } from "@/lib/i18n/hooks/useTranslation";
import { useCurrency } from '@/lib/utils/currency';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AddCollaboratorDialog } from '@/components/collaborators/add-collaborator-dialog'
import { EditCollaboratorDialog } from '@/components/collaborators/edit-collaborator-dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// Fonction helper pour formater le wallet en gérant les cas NaN/null/undefined
const formatWallet = (wallet: number | null | undefined): string => {
  if (wallet === null || wallet === undefined || isNaN(wallet)) {
    return formatCurrency(0)
  }
  return formatCurrency(wallet)
}

export default function CollaboratorsPage() {
  const { currency } = useCurrency()
  const { t } = useTranslation()
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editingCollaborator, setEditingCollaborator] = useState<Collaborator | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [collaboratorToDelete, setCollaboratorToDelete] = useState<Collaborator | null>(null)

  useEffect(() => {
    fetchCollaborators()
    fetchUser()
  }, [])

  const fetchCollaborators = async () => {
    try {
      setError(null)
      const data = await getCollaborators()
      setCollaborators(data)
    } catch (error) {
      const err = error as Error
      setError(err)
      // Ne pas afficher de toast si c'est une erreur d'authentification (redirection automatique)
      if (!err.message.includes('Non authentifié')) {
        toast.error(t('errors.loading'))
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchUser = async () => {
    try {
      const userData = await getUser()
      setUser(userData)
    } catch (error) {
      const err = error as Error
      // Ne pas afficher de toast si c'est une erreur d'authentification (redirection automatique)
      if (!err.message.includes('Non authentifié')) {
        console.error(t('errors.loading'))
      }
    }
  }

  const handleAddSuccess = async () => {
    // Recharger la liste complète pour obtenir tous les wallets calculés
    await fetchCollaborators()
    await fetchUser() // Recharger pour mettre à jour company_share
    toast.success(t('success.collaboratorAdded'))
  }

  const handleEditSuccess = async (updatedCollaborator: Collaborator) => {
    // Recharger le collaborateur depuis l'API pour obtenir le wallet calculé
    try {
      const data = await getCollaboratorById(updatedCollaborator.id)
      setCollaborators(collaborators.map(c => 
        c.id === data.id ? data : c
      ))
    } catch (error) {
      // Si erreur, utiliser les données mises à jour
      setCollaborators(collaborators.map(c => 
        c.id === updatedCollaborator.id ? updatedCollaborator : c
      ))
    }
    toast.success(t('success.collaboratorUpdated'))
  }

  const handleDelete = async () => {
    if (!collaboratorToDelete) return

    try {
      await deleteCollaborator(collaboratorToDelete.id)
      setCollaborators(collaborators.filter(c => c.id !== collaboratorToDelete.id))
      await fetchUser() // Recharger pour mettre à jour company_share
      toast.success(t('success.collaboratorDeleted'))
      setDeleteDialogOpen(false)
      setCollaboratorToDelete(null)
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message || t('errors.loading'))
      } else {
        toast.error(t('errors.loading'))
      }
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-10 w-48" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-10 w-40" />
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-10 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t('nav.collaborators')}</h1>
        <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('collaborators.addCollaborator')}
        </Button>
      </div>

      {/* Liste des collaborateurs */}
      {collaborators.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <UserIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground">{t('collaborators.noCollaborators')}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {t('collaborators.noCollaboratorsDescription')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('collaborators.name')}</TableHead>
                  <TableHead>{t('collaborators.phone')}</TableHead>
                  <TableHead>{t('collaborators.share')}</TableHead>
                  <TableHead>{t('collaborators.wallet')}</TableHead>
                  <TableHead className="text-right">{t('collaborators.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collaborators.map((collaborator) => (
                  <TableRow key={collaborator.id}>
                    <TableCell className="font-medium">
                      {collaborator.name}
                    </TableCell>
                    <TableCell>{collaborator.phone}</TableCell>
                    <TableCell>{collaborator.part}%</TableCell>
                    <TableCell>{formatWallet(collaborator.wallet)} {currency}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingCollaborator(collaborator)
                            setEditDialogOpen(true)
                          }}
                          title={t('common.edit')}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setCollaboratorToDelete(collaborator)
                            setDeleteDialogOpen(true)
                          }}
                          title={t('common.delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Modale d'ajout */}
      <AddCollaboratorDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSuccess={handleAddSuccess}
        user={user ? { company_share: parseFloat(user.company_share || '0') } : null}
      />

      {/* Modale de modification */}
      {editingCollaborator && (
        <EditCollaboratorDialog
          collaborator={editingCollaborator}
          open={editDialogOpen}
          onClose={() => {
            setEditDialogOpen(false)
            setEditingCollaborator(null)
          }}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Dialogue de suppression */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('collaborators.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('collaborators.deleteConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
