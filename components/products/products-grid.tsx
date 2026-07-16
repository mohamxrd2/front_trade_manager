'use client'

import { ProductCard, type Product, articleToProduct } from "./product-card";
import type { Article } from '@/lib/services/articles'

interface ProductsGridProps {
  products: Product[] | Article[]; // Accepter soit Product[] soit Article[]
}

export function ProductsGrid({ products }: ProductsGridProps) {
  // Normaliser les produits : garantir qu'on a toujours un tableau
  const productsArray = Array.isArray(products) ? products : []
  
  if (productsArray.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium text-muted-foreground">
            Aucun produit trouvé
          </p>
          <p className="text-sm text-muted-foreground">
            Commencez par ajouter votre premier produit
          </p>
        </div>
      </div>
    );
  }

  // Normaliser les produits : vérifier si ce sont des Articles ou des Products
  // Vérifier le premier élément pour déterminer le type
  const firstItem = productsArray[0]
  const isArticle = firstItem && typeof firstItem === 'object' && 'sale_price' in firstItem
  
  // Si ce sont des Articles, les passer directement sans conversion pour préserver sales_percentage
  // ProductCard peut gérer les deux types
  const itemsToRender = isArticle
    ? (productsArray as Article[])
    : (productsArray as Product[])

  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {itemsToRender.map((item) => (
        <ProductCard 
          key={isArticle ? (item as Article).id : (item as Product).id} 
          product={item} 
        />
      ))}
    </div>
  );
}

