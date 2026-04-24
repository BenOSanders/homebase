import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Wrench, Trash2, Check, Filter } from 'lucide-react'
import { addMonths, format, parseISO, isAfter, isBefore, addDays } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/hooks/use-toast'
import { formatDate, cn } from '@/lib/utils'
import { MAINTENANCE_CATEGORIES } from '@/types'
import type { MaintenanceItem } from '@/types'

function statusBadge(item: MaintenanceItem) {
  if (!item.next_due) return null
  const now = new Date()
  const due = parseISO(item.next_due)
  const soon = addDays(now, 30)
  if (isAfter(now, due)) return <Badge variant="destructive">Overdue</Badge>
  if (isBefore(due, soon)) return <Badge variant="warning">Due Soon</Badge>
  return <Badge variant="secondary">Upcoming</Badge>
}

export function MaintenancePage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const householdId = profile?.household_id ?? ''

  const [open, setOpen] = useState(false)
  const [markDoneId, setMarkDoneId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [editItem, setEditItem] = useState<MaintenanceItem | null>(null)

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    last_done: '',
    recurrence_months: '',
    notes: '',
  })

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['maintenance', householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_items')
        .select('*')
        .eq('household_id', householdId)
        .order('next_due', { nullsFirst: false })
      if (error) throw error
      return (data ?? []) as MaintenanceItem[]
    },
    enabled: !!householdId,
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const recMonths = form.recurrence_months ? parseInt(form.recurrence_months) : null
      let next_due: string | null = null
      if (form.last_done && recMonths) {
        next_due = format(addMonths(parseISO(form.last_done), recMonths), 'yyyy-MM-dd')
      }

      if (editItem) {
        const { error } = await supabase
          .from('maintenance_items')
          .update({
            title: form.title,
            description: form.description || null,
            category: form.category || null,
            last_done: form.last_done || null,
            next_due,
            recurrence_months: recMonths,
            notes: form.notes || null,
          })
          .eq('id', editItem.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('maintenance_items').insert({
          household_id: householdId,
          title: form.title,
          description: form.description || null,
          category: form.category || null,
          last_done: form.last_done || null,
          next_due,
          recurrence_months: recMonths,
          notes: form.notes || null,
          created_by: profile?.id,
        })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance', householdId] })
      toast({ title: editItem ? 'Item updated' : 'Item added' })
      setOpen(false)
      setEditItem(null)
      setForm({ title: '', description: '', category: '', last_done: '', recurrence_months: '', notes: '' })
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const markDoneMutation = useMutation({
    mutationFn: async (item: MaintenanceItem) => {
      const today = format(new Date(), 'yyyy-MM-dd')
      const next = item.recurrence_months
        ? format(addMonths(new Date(), item.recurrence_months), 'yyyy-MM-dd')
        : null
      const { error } = await supabase
        .from('maintenance_items')
        .update({ last_done: today, next_due: next })
        .eq('id', item.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance', householdId] })
      toast({ title: 'Marked as done' })
      setMarkDoneId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('maintenance_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance', householdId] })
      toast({ title: 'Item deleted' })
      setDeleteId(null)
    },
  })

  function openEdit(item: MaintenanceItem) {
    setEditItem(item)
    setForm({
      title: item.title,
      description: item.description ?? '',
      category: item.category ?? '',
      last_done: item.last_done ?? '',
      recurrence_months: item.recurrence_months?.toString() ?? '',
      notes: item.notes ?? '',
    })
    setOpen(true)
  }

  const filtered =
    categoryFilter === 'all' ? items : items.filter((i) => i.category === categoryFilter)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Maintenance</h1>
          <p className="text-muted-foreground">Track and schedule home maintenance tasks.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditItem(null); setForm({ title: '', description: '', category: '', last_done: '', recurrence_months: '', notes: '' }) } }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Item</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editItem ? 'Edit Item' : 'Add Maintenance Item'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Title *</Label>
                <Input
                  placeholder="e.g. Replace HVAC filter"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Category</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {MAINTENANCE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Recurrence (months)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 3"
                    min={1}
                    value={form.recurrence_months}
                    onChange={(e) => setForm((f) => ({ ...f, recurrence_months: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Last done</Label>
                <Input
                  type="date"
                  value={form.last_done}
                  onChange={(e) => setForm((f) => ({ ...f, last_done: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Description</Label>
                <Textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Notes</Label>
                <Textarea
                  rows={2}
                  placeholder="Contractor info, model numbers, etc."
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.title.trim() || saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : editItem ? 'Update' : 'Add Item'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {MAINTENANCE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No maintenance items"
          description="Add your first maintenance task to start tracking."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <Card key={item.id} className="cursor-pointer hover:shadow-sm" onClick={() => openEdit(item)}>
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{item.title}</p>
                    {statusBadge(item)}
                  </div>
                  {item.category && (
                    <p className="text-sm text-muted-foreground">{item.category}</p>
                  )}
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {item.last_done && <span>Last done: {formatDate(item.last_done)}</span>}
                    {item.next_due && <span>Next due: {formatDate(item.next_due)}</span>}
                    {item.recurrence_months && <span>Every {item.recurrence_months} months</span>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-green-600"
                    onClick={() => setMarkDoneId(item.id)}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteId(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!markDoneId}
        onOpenChange={(v) => !v && setMarkDoneId(null)}
        title="Mark as done today?"
        description="This will update the last done date and calculate the next due date."
        confirmLabel="Mark Done"
        onConfirm={() => {
          const item = items.find((i) => i.id === markDoneId)
          if (item) markDoneMutation.mutate(item)
        }}
      />
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
        title="Delete this item?"
        confirmLabel="Delete"
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId) }}
        destructive
      />
    </div>
  )
}
