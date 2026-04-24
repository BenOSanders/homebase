import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, CheckSquare, Check, RotateCcw, Trash2, User2 } from 'lucide-react'
import { addDays, addWeeks, addMonths, format } from 'date-fns'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useHouseholdMembers } from '@/hooks/useHousehold'
import { toast } from '@/hooks/use-toast'
import { formatDate, cn } from '@/lib/utils'
import { isAfter, parseISO } from 'date-fns'
import type { Chore, Profile } from '@/types'
import { CHORE_RECURRENCE_OPTIONS } from '@/types'

function nextDueDate(recurrence: string | null, from: Date): string | null {
  if (!recurrence || recurrence === 'once') return null
  if (recurrence === 'daily') return format(addDays(from, 1), 'yyyy-MM-dd')
  if (recurrence === 'weekly') return format(addWeeks(from, 1), 'yyyy-MM-dd')
  if (recurrence === 'biweekly') return format(addWeeks(from, 2), 'yyyy-MM-dd')
  if (recurrence === 'monthly') return format(addMonths(from, 1), 'yyyy-MM-dd')
  return null
}

interface ChoreFormData {
  title: string
  description: string
  assigned_to: string
  recurrence: string
  due_date: string
}

function ChoreCard({
  chore,
  members,
  onComplete,
  onDelete,
}: {
  chore: Chore
  members: Profile[]
  onComplete: (chore: Chore) => void
  onDelete: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const now = new Date()
  const isOverdue = chore.due_date && !chore.completed_at && isAfter(now, parseISO(chore.due_date))
  const assignee = members.find((m) => m.id === chore.assigned_to)

  return (
    <>
      <Card className={cn('transition-opacity', chore.completed_at && 'opacity-60')}>
        <CardContent className="flex items-start justify-between gap-4 p-4">
          <div className="flex items-start gap-3">
            <button
              onClick={() => onComplete(chore)}
              className={cn(
                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                chore.completed_at
                  ? 'border-green-500 bg-green-500 text-white'
                  : 'border-muted-foreground hover:border-primary'
              )}
            >
              {chore.completed_at && <Check className="h-3 w-3" />}
            </button>
            <div>
              <p className={cn('font-medium', chore.completed_at && 'line-through text-muted-foreground')}>
                {chore.title}
              </p>
              {chore.description && (
                <p className="mt-0.5 text-sm text-muted-foreground">{chore.description}</p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {chore.due_date && (
                  <Badge variant={isOverdue ? 'destructive' : 'secondary'} className="text-xs">
                    {formatDate(chore.due_date)}
                  </Badge>
                )}
                {chore.recurrence && chore.recurrence !== 'once' && (
                  <Badge variant="outline" className="text-xs">
                    <RotateCcw className="mr-1 h-3 w-3" />
                    {CHORE_RECURRENCE_OPTIONS.find((o) => o.value === chore.recurrence)?.label}
                  </Badge>
                )}
                {assignee && (
                  <Badge variant="outline" className="text-xs">
                    <User2 className="mr-1 h-3 w-3" />
                    {assignee.display_name}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete chore?"
        description={`"${chore.title}" will be permanently deleted.`}
        confirmLabel="Delete"
        onConfirm={() => onDelete(chore.id)}
        destructive
      />
    </>
  )
}

export function ChoresPage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const householdId = profile?.household_id ?? ''
  const { data: members = [] } = useHouseholdMembers(householdId)

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ChoreFormData>({
    title: '',
    description: '',
    assigned_to: '',
    recurrence: 'once',
    due_date: '',
  })

  const { data: chores = [], isLoading } = useQuery({
    queryKey: ['chores', householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chores')
        .select('*')
        .eq('household_id', householdId)
        .order('due_date', { nullsFirst: false })
      if (error) throw error
      return (data ?? []) as Chore[]
    },
    enabled: !!householdId,
  })

  const addMutation = useMutation({
    mutationFn: async (data: ChoreFormData) => {
      const { error } = await supabase.from('chores').insert({
        household_id: householdId,
        title: data.title,
        description: data.description || null,
        assigned_to: data.assigned_to || null,
        recurrence: (data.recurrence as Chore['recurrence']) || null,
        due_date: data.due_date || null,
        created_by: profile?.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chores', householdId] })
      toast({ title: 'Chore added' })
      setOpen(false)
      setForm({ title: '', description: '', assigned_to: '', recurrence: 'once', due_date: '' })
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const completeMutation = useMutation({
    mutationFn: async (chore: Chore) => {
      if (chore.completed_at) {
        await supabase.from('chores').update({ completed_at: null }).eq('id', chore.id)
      } else {
        await supabase.from('chores').update({ completed_at: new Date().toISOString() }).eq('id', chore.id)
        const next = nextDueDate(chore.recurrence, new Date())
        if (next) {
          await supabase.from('chores').insert({
            household_id: chore.household_id,
            title: chore.title,
            description: chore.description,
            assigned_to: chore.assigned_to,
            recurrence: chore.recurrence,
            due_date: next,
            created_by: chore.created_by,
          })
        }
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chores', householdId] }),
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chores').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chores', householdId] })
      toast({ title: 'Chore deleted' })
    },
  })

  const pending = chores.filter((c) => !c.completed_at)
  const completed = chores.filter((c) => c.completed_at)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Chores</h1>
          <p className="text-muted-foreground">Manage household tasks and assignments.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Chore</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Chore</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Title *</Label>
                <Input
                  placeholder="e.g. Vacuum living room"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Optional details…"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Assign to</Label>
                  <Select
                    value={form.assigned_to}
                    onValueChange={(v) => setForm((f) => ({ ...f, assigned_to: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Anyone" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Anyone</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Recurrence</Label>
                  <Select
                    value={form.recurrence}
                    onValueChange={(v) => setForm((f) => ({ ...f, recurrence: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CHORE_RECURRENCE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Due date</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                onClick={() => addMutation.mutate(form)}
                disabled={!form.title.trim() || addMutation.isPending}
              >
                {addMutation.isPending ? 'Adding…' : 'Add Chore'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            To Do <Badge variant="secondary" className="ml-2">{pending.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="done">
            Done <Badge variant="secondary" className="ml-2">{completed.length}</Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4">
          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : pending.length === 0 ? (
            <EmptyState
              icon={CheckSquare}
              title="All caught up!"
              description="No pending chores. Add one to get started."
            />
          ) : (
            <div className="space-y-2">
              {pending.map((chore) => (
                <ChoreCard
                  key={chore.id}
                  chore={chore}
                  members={members}
                  onComplete={(c) => completeMutation.mutate(c)}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="done" className="mt-4">
          {completed.length === 0 ? (
            <EmptyState icon={CheckSquare} title="No completed chores yet." />
          ) : (
            <div className="space-y-2">
              {completed.map((chore) => (
                <ChoreCard
                  key={chore.id}
                  chore={chore}
                  members={members}
                  onComplete={(c) => completeMutation.mutate(c)}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
