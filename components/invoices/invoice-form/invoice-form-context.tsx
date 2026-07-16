'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Client, InvoiceTheme, DiscountType } from '@/lib/services/invoices'
import type { Article } from '@/lib/services/articles'

// ============================================================================
// TYPES
// ============================================================================

export interface InvoiceLineItem {
  id: string
  article: Article | null
  quantity: number
  unitPrice: number
  discountPercent: number
  total: number
}

export interface InvoiceFormData {
  // Step 1: Client
  client: Client | null

  // Step 2: Items
  items: InvoiceLineItem[]

  // Step 3: Calculs
  discountType: DiscountType
  discountValue: number
  taxRate: number
  shippingFee: number

  // Step 4: Adresses
  billingAddress: string
  shippingAddress: string
  notes: string
  terms: string
  dueDate: string | null

  // Step 5: Thème
  theme: InvoiceTheme
}

export interface InvoiceFormContextType {
  // Data
  formData: InvoiceFormData
  updateFormData: (data: Partial<InvoiceFormData>) => void

  // Items management
  addItem: () => void
  removeItem: (id: string) => void
  updateItem: (id: string, data: Partial<InvoiceLineItem>) => void

  // Calculations
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number

  // Steps
  currentStep: number
  setCurrentStep: (step: number) => void
  canProceed: boolean
  isLastStep: boolean
}

// ============================================================================
// CONTEXT
// ============================================================================

const InvoiceFormContext = createContext<InvoiceFormContextType | undefined>(undefined)

export function useInvoiceForm() {
  const context = useContext(InvoiceFormContext)
  if (!context) {
    throw new Error('useInvoiceForm must be used within InvoiceFormProvider')
  }
  return context
}

// ============================================================================
// PROVIDER
// ============================================================================

const TOTAL_STEPS = 5

const generateItemId = () => Math.random().toString(36).substring(2, 9)

const initialFormData: InvoiceFormData = {
  client: null,
  items: [{ id: generateItemId(), article: null, quantity: 1, unitPrice: 0, discountPercent: 0, total: 0 }],
  discountType: 'percentage',
  discountValue: 0,
  taxRate: 0,
  shippingFee: 0,
  billingAddress: '',
  shippingAddress: '',
  notes: '',
  terms: '',
  dueDate: null,
  theme: 'modern',
}

export function InvoiceFormProvider({ children }: { children: ReactNode }) {
  const [formData, setFormData] = useState<InvoiceFormData>(initialFormData)
  const [currentStep, setCurrentStep] = useState(1)

  // Update form data
  const updateFormData = (data: Partial<InvoiceFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }))
  }

  // Items management
  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { id: generateItemId(), article: null, quantity: 1, unitPrice: 0, discountPercent: 0, total: 0 },
      ],
    }))
  }

  const removeItem = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
    }))
  }

  const updateItem = (id: string, data: Partial<InvoiceLineItem>) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id === id) {
          const updated = { ...item, ...data }
          // Recalculate total with line discount
          const lineSubtotal = updated.quantity * updated.unitPrice
          const lineDiscount = (lineSubtotal * (updated.discountPercent || 0)) / 100
          updated.total = lineSubtotal - lineDiscount
          return updated
        }
        return item
      }),
    }))
  }

  // Calculations
  const subtotal = formData.items.reduce((sum, item) => sum + item.total, 0)

  const discountAmount =
    formData.discountType === 'percentage'
      ? (subtotal * formData.discountValue) / 100
      : formData.discountValue

  const taxableAmount = subtotal - discountAmount
  const taxAmount = (taxableAmount * formData.taxRate) / 100
  const total = taxableAmount + taxAmount + formData.shippingFee

  // Step validation
  const canProceed = (() => {
    switch (currentStep) {
      case 1:
        return formData.client !== null
      case 2:
        return (
          formData.items.length > 0 &&
          formData.items.every((item) => item.article !== null && item.quantity > 0)
        )
      case 3:
        return true // Calculs are always valid (can be 0)
      case 4:
        return true // Addresses are optional
      case 5:
        return true // Theme always has a default
      default:
        return false
    }
  })()

  const isLastStep = currentStep === TOTAL_STEPS

  return (
    <InvoiceFormContext.Provider
      value={{
        formData,
        updateFormData,
        addItem,
        removeItem,
        updateItem,
        subtotal,
        discountAmount,
        taxAmount,
        total,
        currentStep,
        setCurrentStep,
        canProceed,
        isLastStep,
      }}
    >
      {children}
    </InvoiceFormContext.Provider>
  )
}

