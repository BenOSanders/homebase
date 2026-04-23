import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  parseISO,
  isSameDay,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, X, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/hooks/use-toast'
import type { MealPlan, Recipe } from '@/types'
import { MEAL_TYPES } from '@/types'

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

export function MealCalendarPage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const householdId = profile?.household_id ?? ''

  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )
  const [addSlot, setAddSlot] = useState<{ date: string; mealType: string } | null>(null)
  const [customName, setCustomName] = useState('')
  const [selectedRecipe, setSelectedRecipe] = useState('')

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekStartStr = format(weekStart, 'yyyy-MM-dd')
  const weekEndStr = format(addDays(weekStart, 6), 'yyyy-MM-dd')

  const { data: meals = [] } = useQuery({
    queryKey: ['meal-plan', householdId, weekStartStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meal_plan')
        .select('*, recipe:recipes(*)')
        .eq('household_id', householdId)
        .gte('date', weekStartStr)
        .lte('date', weekEndStr)
      if (error) throw error
      return (data ?? []) as (MealPlan & { recipe: Recipe | null })[]
    },
    enabled: !!householdId,
  })

  const { data: recipes = [] } = useQuery({
    queryKey: ['recipes', householdId],
    queryFn: async () => {
      const { data } = await supabase
        .from('recipes')
        .select('id, title')
        .eq('household_id', householdId)
        .order('title')
      return (data ?? []) as Pick<Recipe, 'id' | 'title'>[]
    },
    enabled: !!householdId,
  })

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!addSlot) return
      const { error } = await supabase
        .from('meal_plan')
        .upsert({
          household_id: householdId,
          date: addSlot.date,
          meal_type: addSlot.mealType as MealPlan['meal_type'],
          recipe_id: selectedRecipe || null,
          custom_name: customName || null,
        })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-plan', householdId, weekStartStr] })
      setAddSlot(null)
      setCustomName('')
      setSelectedRecipe('')
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meal_plan').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meal-plan', householdId, weekStartStr] }),
  })

  function getMeal(date: Date, mealType: string) {
    return meals.find(
      (m) => isSameDay(parseISO(m.date), date) && m.meal_type === mealType
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meal Calendar</h1>
          <p className="text-muted-foreground">Plan your household's meals for the week.</p>
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setWeekStart((w) => subWeeks(w, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-48 text-center font-medium">
          {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
        </span>
        <Button variant="outline" size="icon" onClick={() => setWeekStart((w) => addWeeks(w, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
          Today
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-24 pb-2 text-left text-xs font-medium text-muted-foreground" />
              {weekDays.map((day) => (
                <th
                  key={day.toISOString()}
                  className={cn(
                    'pb-2 text-center text-xs font-medium',
                    isSameDay(day, new Date()) ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  <div>{format(day, 'EEE')}</div>
                  <div
                    className={cn(
                      'mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold',
                      isSameDay(day, new Date()) && 'bg-primary text-primary-foreground'
                    )}
                  >
                    {format(day, 'd')}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MEAL_TYPES.map((mealType) => (
              <tr key={mealType} className="border-t">
                <td className="py-2 pr-3 text-xs font-medium text-muted-foreground">
                  {MEAL_LABELS[mealType]}
                </td>
                {weekDays.map((day) => {
                  const meal = getMeal(day, mealType)
                  const dateStr = format(day, 'yyyy-MM-dd')
                  return (
                    <td key={day.toISOString()} className="p-1">
                      {meal ? (
                        <div className="group relative flex min-h-12 items-center justify-between rounded-md bg-primary/10 px-2 py-1.5 text-xs">
                          <div className="flex items-center gap-1">
                            {meal.recipe && <BookOpen className="h-3 w-3 text-primary" />}
                            <span className="font-medium">
                              {meal.recipe?.title ?? meal.custom_name}
                            </span>
                          </div>
                          <button
                            onClick={() => deleteMutation.mutate(meal.id)}
                            className="ml-1 hidden rounded text-muted-foreground hover:text-destructive group-hover:block"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAddSlot({ date: dateStr, mealType })}
                          className="flex min-h-12 w-full items-center justify-center rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!addSlot} onOpenChange={(v) => { if (!v) { setAddSlot(null); setCustomName(''); setSelectedRecipe('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add {addSlot ? MEAL_LABELS[addSlot.mealType] : ''} —{' '}
              {addSlot ? format(parseISO(addSlot.date), 'EEE, MMM d') : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>From your recipes</Label>
              <Select value={selectedRecipe} onValueChange={setSelectedRecipe}>
                <SelectTrigger><SelectValue placeholder="Choose a recipe…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {recipes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!selectedRecipe && (
              <div className="grid gap-2">
                <Label>Or enter a custom meal name</Label>
                <Input
                  placeholder="e.g. Takeout pizza"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSlot(null)}>Cancel</Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={(!selectedRecipe && !customName.trim()) || addMutation.isPending}
            >
              {addMutation.isPending ? 'Saving…' : 'Add Meal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
