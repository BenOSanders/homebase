import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, ShoppingCart, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/shared/EmptyState'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { SHOPPING_CATEGORIES } from '@/types'
import type { ShoppingListItem } from '@/types'

export function ShoppingListPage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const householdId = profile?.household_id ?? ''

  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [category, setCategory] = useState('')

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['shopping-list', householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shopping_list_items')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as ShoppingListItem[]
    },
    enabled: !!householdId,
  })

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('shopping_list_items').insert({
        household_id: householdId,
        name: name.trim(),
        quantity: quantity.trim() || null,
        category: category || null,
        added_by: profile?.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list', householdId] })
      setName('')
      setQuantity('')
      setCategory('')
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, checked }: { id: string; checked: boolean }) => {
      const { error } = await supabase
        .from('shopping_list_items')
        .update({ checked })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shopping-list', householdId] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shopping_list_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shopping-list', householdId] }),
  })

  const clearCheckedMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('shopping_list_items')
        .delete()
        .eq('household_id', householdId)
        .eq('checked', true)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list', householdId] })
      toast({ title: 'Cleared checked items' })
    },
  })

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && name.trim()) addMutation.mutate()
  }

  const unchecked = items.filter((i) => !i.checked)
  const checked = items.filter((i) => i.checked)

  // Group unchecked items by category
  const grouped = unchecked.reduce<Record<string, ShoppingListItem[]>>((acc, item) => {
    const key = item.category ?? 'Uncategorized'
    acc[key] = [...(acc[key] ?? []), item]
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Shopping List</h1>
          <p className="text-muted-foreground">
            {unchecked.length} item{unchecked.length !== 1 ? 's' : ''} remaining
          </p>
        </div>
        {checked.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => clearCheckedMutation.mutate()}
            disabled={clearCheckedMutation.isPending}
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            Clear {checked.length} checked
          </Button>
        )}
      </div>

      {/* Add item form */}
      <div className="flex gap-2">
        <Input
          placeholder="Add an item…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Input
          placeholder="Qty"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-24"
        />
        <div className="w-44">
          <Select
            value={category || '__none__'}
            onValueChange={(v) => setCategory(v === '__none__' ? '' : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No category</SelectItem>
              {SHOPPING_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => addMutation.mutate()} disabled={!name.trim() || addMutation.isPending}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Your list is empty"
          description="Add items above to get started."
        />
      ) : (
        <div className="space-y-6">
          {/* Unchecked items grouped by category */}
          {Object.entries(grouped).map(([cat, catItems]) => (
            <div key={cat}>
              <div className="mb-2 flex items-center gap-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {cat}
                </Label>
                <Badge variant="secondary" className="text-xs">{catItems.length}</Badge>
              </div>
              <div className="space-y-1">
                {catItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onToggle={(checked) => toggleMutation.mutate({ id: item.id, checked })}
                    onDelete={() => deleteMutation.mutate(item.id)}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Checked items */}
          {checked.length > 0 && (
            <div>
              <Label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Checked ({checked.length})
              </Label>
              <div className="space-y-1">
                {checked.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onToggle={(c) => toggleMutation.mutate({ id: item.id, checked: c })}
                    onDelete={() => deleteMutation.mutate(item.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item: ShoppingListItem
  onToggle: (checked: boolean) => void
  onDelete: () => void
}) {
  return (
    <div className={cn(
      'flex items-center gap-3 rounded-md border px-3 py-2 transition-colors',
      item.checked && 'bg-muted/40'
    )}>
      <Checkbox
        checked={item.checked}
        onCheckedChange={(v) => onToggle(!!v)}
        className="shrink-0"
      />
      <span className={cn('flex-1 text-sm', item.checked && 'line-through text-muted-foreground')}>
        {item.name}
      </span>
      {item.quantity && (
        <span className="shrink-0 text-xs text-muted-foreground">{item.quantity}</span>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
