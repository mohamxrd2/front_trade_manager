'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { addArticle, type ValidationErrors } from '@/lib/services/articles'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { invalidateAll } from '@/lib/hooks/useCache'
import { useTranslation } from "@/lib/i18n/hooks/useTranslation"
import { isSilentError } from '@/lib/utils/error-handler'
import { useCurrency } from '@/lib/utils/currency'

// Fonction pour créer le schéma de validation Zod pour le formulaire d'ajout de produit
const createProductSchema = (t: (key: string, params?: Record<string, string | number>) => string) => z.object({
  name: z
    .string()
    .min(1, t('products.validation.nameRequired'))
    .min(2, t('products.validation.nameMin')),
  sale_price: z
    .string()
    .min(1, t('products.validation.priceRequired'))
    .transform((val) => parseFloat(val))
    .refine((val) => !isNaN(val), {
      message: t('products.validation.priceMustBeNumber'),
    })
    .refine((val) => val >= 0, {
      message: t('products.validation.pricePositive'),
    })
    .refine((val) => val >= 0.01, {
      message: t('products.validation.priceMin'),
    }),
  quantity: z
    .string()
    .min(1, t('products.validation.quantityRequired'))
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val), {
      message: t('products.validation.quantityMustBeNumber'),
    })
    .refine((val) => val >= 0, {
      message: t('products.validation.quantityPositive'),
    })
    .refine((val) => Number.isInteger(val), {
      message: t('products.validation.quantityMustBeInteger'),
    }),
  type: z.enum(['simple', 'variable'], {
    message: t('products.validation.invalidType'),
  }),
});

// Type pour les valeurs du formulaire (avant transformation Zod)
type ProductFormInput = {
  name: string;
  sale_price: string;
  quantity: string;
  type: 'simple' | 'variable';
};

// Type pour les données après validation (après transformation Zod)
type ProductFormData = {
  name: string;
  sale_price: number;
  quantity: number;
  type: 'simple' | 'variable';
};

interface ProductsListHeaderProps {
  productsCount: number;
  onProductAdded?: () => void; // Callback pour rafraîchir la liste
}

export function ProductsListHeader({ 
  productsCount,
  onProductAdded 
}: ProductsListHeaderProps) {
  const { t } = useTranslation()
  const { currency } = useCurrency()
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiErrors, setApiErrors] = useState<ValidationErrors>({});

  // Créer le schéma avec la fonction de traduction
  const productSchema = createProductSchema(t)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
    setError,
  } = useForm<ProductFormInput, object, ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      type: 'simple' as const,
      quantity: '',
      sale_price: '',
    },
  });

  const productType = watch('type');

  const onSubmit = async (data: ProductFormData) => {
    setIsSubmitting(true);
    setApiErrors({});

    try {
      // Préparer les données pour l'API
      const payload = {
        name: data.name.trim(),
        sale_price: data.sale_price,
        quantity: data.quantity,
        type: data.type,
        image: null,
      };

      // Appeler l'API pour créer l'article
      const newArticle = await addArticle(payload);

      // Afficher un toast de succès
      toast.success(t('products.success.added'), {
        description: t('products.success.addedDescription', { name: newArticle.name }),
        duration: 3000,
      });

      // Réinitialiser le formulaire
      reset();
      setApiErrors({});

      // Fermer le modal immédiatement
      setOpen(false);

      // Invalider tous les caches pour forcer le rafraîchissement en arrière-plan
      // Les données en cache restent visibles pendant le rechargement (pas de clignotement)
      // Les nouvelles données remplaceront les anciennes une fois chargées
      await invalidateAll(true);
      
      // Rafraîchir la liste des produits (callback optionnel)
      if (onProductAdded) {
        onProductAdded();
      }
    } catch (error: unknown) {
      const err = error as Error & {
        status?: number
        errors?: ValidationErrors
      }

      // Erreur 422 : Validation Laravel
      if (err.status === 422 && err.errors) {
        setApiErrors(err.errors);
        
        // Afficher les erreurs sous les champs correspondants
        Object.keys(err.errors).forEach((field) => {
          const fieldErrors = err.errors![field]
          if (fieldErrors && fieldErrors.length > 0) {
            // Mapper les noms de champs Laravel vers les noms du formulaire
            const formField = field === 'sale_price' ? 'sale_price' : 
                            field === 'name' ? 'name' : 
                            field === 'quantity' ? 'quantity' : 
                            field === 'type' ? 'type' : field
            
            setError(formField as keyof ProductFormData, {
              type: 'server',
              message: fieldErrors[0], // Prendre le premier message d'erreur
            })
          }
        })

        // Afficher un toast d'erreur de validation
        toast.error(t('errors.validation'), {
          description: t('products.validation.correctErrors'),
          duration: 4000,
        });
      } 
      // Erreur 500 ou autre
      else {
        const errorMessage = err.message || t('products.errors.addFailed')
        
        toast.error(t('errors.loading'), {
          description: errorMessage,
          duration: 5000,
        });

        if (process.env.NODE_ENV !== 'production') {
          console.error('Erreur lors de l\'ajout du produit:', error);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fonction pour obtenir les erreurs d'un champ (Zod + API)
  const getFieldError = (fieldName: keyof ProductFormData): string | undefined => {
    // Priorité aux erreurs Zod (validation côté client)
    if (errors[fieldName]) {
      return errors[fieldName]?.message
    }
    
    // Ensuite les erreurs de l'API
    if (apiErrors[fieldName]) {
      return apiErrors[fieldName][0]
    }
    
    // Mapper les noms de champs Laravel
    const laravelField = fieldName === 'sale_price' ? 'sale_price' : 
                        fieldName === 'name' ? 'name' : 
                        fieldName === 'quantity' ? 'quantity' : 
                        fieldName === 'type' ? 'type' : fieldName
    
    if (apiErrors[laravelField]) {
      return apiErrors[laravelField][0]
    }
    
    return undefined
  }

  // Fonction pour vérifier si un champ a une erreur
  const hasFieldError = (fieldName: keyof ProductFormData): boolean => {
    return !!getFieldError(fieldName)
  }

  return (
    <div className="flex items-center justify-between px-4 lg:px-6 py-4">
      <div>
        <h2 className="text-xl font-semibold">
          {t('products.productList')} ({productsCount})
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('products.productListDescription')}
        </p>
      </div>

      <Dialog open={open} onOpenChange={(newOpen) => {
        setOpen(newOpen);
        if (!newOpen) {
          // Réinitialiser le formulaire et les erreurs quand on ferme
          reset();
          setApiErrors({});
        }
      }}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            {t('common.add')}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('products.addNewProduct')}</DialogTitle>
            <DialogDescription>
              {t('products.addProductDescription')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              {/* Nom du produit */}
              <div className="grid gap-2">
                <Label htmlFor="name">
                  {t('products.productName')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder={t('products.productNamePlaceholder')}
                  {...register('name')}
                  disabled={isSubmitting}
                  className={cn(
                    hasFieldError('name') && 'border-red-500 focus-visible:ring-red-500'
                  )}
                />
                {getFieldError('name') && (
                  <p className="text-xs text-red-500">{getFieldError('name')}</p>
                )}
              </div>

              {/* Type de produit */}
              <div className="grid gap-2">
                <Label htmlFor="type">
                  {t('products.productType')} <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={productType}
                  onValueChange={(value) => setValue('type', value as 'simple' | 'variable')}
                  disabled={isSubmitting}
                >
                  <SelectTrigger 
                    id="type"
                    className={cn(
                      hasFieldError('type') && 'border-red-500 focus-visible:ring-red-500'
                    )}
                  >
                    <SelectValue placeholder={t('common.select')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple">{t('products.simple')}</SelectItem>
                    <SelectItem value="variable">{t('products.variable')}</SelectItem>
                  </SelectContent>
                </Select>
                {getFieldError('type') && (
                  <p className="text-xs text-red-500">{getFieldError('type')}</p>
                )}
              </div>

              {/* Quantité en stock */}
              <div className="grid gap-2">
                <Label htmlFor="quantity">
                  {t('products.quantityInStock')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  placeholder={t('products.quantityPlaceholder')}
                  min="0"
                  step="1"
                  {...register('quantity')}
                  disabled={isSubmitting}
                  className={cn(
                    hasFieldError('quantity') && 'border-red-500 focus-visible:ring-red-500'
                  )}
                />
                {getFieldError('quantity') && (
                  <p className="text-xs text-red-500">{getFieldError('quantity')}</p>
                )}
              </div>

              {/* Prix unitaire */}
              <div className="grid gap-2">
                <Label htmlFor="sale_price">
                  {t('products.unitPrice')} ({currency}) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="sale_price"
                  type="number"
                  placeholder={t('products.pricePlaceholder')}
                  min="0"
                  step="0.01"
                  {...register('sale_price')}
                  disabled={isSubmitting}
                  className={cn(
                    hasFieldError('sale_price') && 'border-red-500 focus-visible:ring-red-500'
                  )}
                />
                {getFieldError('sale_price') && (
                  <p className="text-xs text-red-500">{getFieldError('sale_price')}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  reset();
                  setApiErrors({});
                  setOpen(false);
                }}
                disabled={isSubmitting}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <span className="mr-2">⏳</span>
                    {t('common.loading')}
                  </>
                ) : (
                  t('common.save')
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
