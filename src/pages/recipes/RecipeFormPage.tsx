import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/hooks/use-toast'
import type { Json } from '@/types/database'
import type { Recipe, RecipeIngredient, RecipeInstruction } from '@/types'

export function RecipeFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const householdId = profile?.household_id ?? ''

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [servings, setServings] = useState('')
  const [prepTime, setPrepTime] = useState('')
  const [cookTime, setCookTime] = useState('')
  const [tags, setTags] = useState('')
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([{ name: '', amount: '', unit: '' }])
  const [instructions, setInstructions] = useState<RecipeInstruction[]>([{ step: 1, text: '' }])

  const { data: existing } = useQuery({
    queryKey: ['recipe', id],
    queryFn: async () => {
      if (!id) return null
      const { data } = await supabase.from('recipes').select('*').eq('id', id).single()
      return data as Recipe | null
    },
    enabled: isEdit,
  })

  useEffect(() => {
    if (existing) {
      setTitle(existing.title)
      setDescription(existing.description ?? '')
      setServings(existing.servings?.toString() ?? '')
      setPrepTime(existing.prep_time_mins?.toString() ?? '')
      setCookTime(existing.cook_time_mins?.toString() ?? '')
      setTags(existing.tags.join(', '))
      setIngredients(existing.ingredients.length ? existing.ingredients : [{ name: '', amount: '', unit: '' }])
      setInstructions(existing.instructions.length ? existing.instructions : [{ step: 1, text: '' }])
    }
  }, [existing])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        household_id: householdId,
        title: title.trim(),
        description: description.trim() || null,
        servings: servings ? parseInt(servings) : null,
        prep_time_mins: prepTime ? parseInt(prepTime) : null,
        cook_time_mins: cookTime ? parseInt(cookTime) : null,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        ingredients: ingredients.filter((i) => i.name.trim()) as unknown as Json,
        instructions: instructions.filter((i) => i.text.trim()).map((i, idx) => ({ ...i, step: idx + 1 })) as unknown as Json,
        created_by: profile?.id,
      }
      if (isEdit && id) {
        const { error } = await supabase.from('recipes').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('recipes').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes', householdId] })
      toast({ title: isEdit ? 'Recipe updated' : 'Recipe created' })
      navigate('/recipes')
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  function addIngredient() {
    setIngredients((prev) => [...prev, { name: '', amount: '', unit: '' }])
  }
  function removeIngredient(i: number) {
    setIngredients((prev) => prev.filter((_, idx) => idx !== i))
  }
  function updateIngredient(i: number, field: keyof RecipeIngredient, value: string) {
    setIngredients((prev) => prev.map((ing, idx) => (idx === i ? { ...ing, [field]: value } : ing)))
  }

  function addInstruction() {
    setInstructions((prev) => [...prev, { step: prev.length + 1, text: '' }])
  }
  function removeInstruction(i: number) {
    setInstructions((prev) => prev.filter((_, idx) => idx !== i).map((ins, idx) => ({ ...ins, step: idx + 1 })))
  }
  function updateInstruction(i: number, text: string) {
    setInstructions((prev) => prev.map((ins, idx) => (idx === i ? { ...ins, text } : ins)))
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/recipes')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? 'Edit Recipe' : 'New Recipe'}</h1>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Basic Info</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label>Title *</Label>
            <Input placeholder="e.g. Spaghetti Bolognese" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea rows={2} placeholder="A brief description…" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>Servings</Label>
              <Input type="number" min={1} value={servings} onChange={(e) => setServings(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Prep (min)</Label>
              <Input type="number" min={0} value={prepTime} onChange={(e) => setPrepTime(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Cook (min)</Label>
              <Input type="number" min={0} value={cookTime} onChange={(e) => setCookTime(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Tags (comma-separated)</Label>
            <Input placeholder="e.g. Italian, Pasta, Quick" value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Ingredients</CardTitle>
          <Button variant="outline" size="sm" onClick={addIngredient}>
            <Plus className="mr-1 h-3.5 w-3.5" />Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {ingredients.map((ing, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                className="flex-1"
                placeholder="Ingredient"
                value={ing.name}
                onChange={(e) => updateIngredient(i, 'name', e.target.value)}
              />
              <Input
                className="w-24"
                placeholder="Amount"
                value={ing.amount}
                onChange={(e) => updateIngredient(i, 'amount', e.target.value)}
              />
              <Input
                className="w-20"
                placeholder="Unit"
                value={ing.unit}
                onChange={(e) => updateIngredient(i, 'unit', e.target.value)}
              />
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeIngredient(i)}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Instructions</CardTitle>
          <Button variant="outline" size="sm" onClick={addInstruction}>
            <Plus className="mr-1 h-3.5 w-3.5" />Add Step
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {instructions.map((ins, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2.5 text-sm font-bold text-muted-foreground">{ins.step}.</span>
              <Textarea
                rows={2}
                className="flex-1"
                placeholder={`Step ${ins.step}…`}
                value={ins.text}
                onChange={(e) => updateInstruction(i, e.target.value)}
              />
              <Button variant="ghost" size="icon" className="mt-1 h-8 w-8 shrink-0" onClick={() => removeInstruction(i)}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate('/recipes')}>Cancel</Button>
        <Button onClick={() => saveMutation.mutate()} disabled={!title.trim() || saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving…' : isEdit ? 'Update Recipe' : 'Save Recipe'}
        </Button>
      </div>
    </div>
  )
}
