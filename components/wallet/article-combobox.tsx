'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

// Interface pour les options de recherche
export interface SearchOption {
  id: string
  label: string
  articleId: string
  variableId?: string | null
  article: {
    id: string | number
    name: string
    sale_price: number
    type: 'simple' | 'variable'
  }
  variation?: {
    id: string
    name: string
    remaining_quantity: number
  } | null
  remainingQuantity: number
}

interface ArticleComboboxProps {
  options: SearchOption[]
  value: SearchOption | null
  onSelect: (option: SearchOption | null) => void
  placeholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
}

export function ArticleCombobox({
  options,
  value,
  onSelect,
  placeholder = 'Rechercher un article...',
  emptyMessage = 'Aucun article trouvé',
  disabled = false,
  className,
}: ArticleComboboxProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between',
            !value && 'text-muted-foreground',
            className
          )}
          disabled={disabled}
        >
          {value ? value.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.label}
                  onSelect={() => {
                    onSelect(option)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value?.id === option.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

