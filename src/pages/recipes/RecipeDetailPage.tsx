import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Clock, Users, Edit2, Trash2, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/hooks/use-toast'
import { useState } from 'react'
import type { Recipe } from '@/types'

export function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: recipe, isLoading } = useQuery({
    queryKey: ['recipe', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('recipes').select('*').eq('id', id!).single()
      if (error) throw error
      return {
        ...data,
        ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
        instructions: Array.isArray(data.instructions) ? data.instructions : [],
        tags: Array.isArray(data.tags) ? data.tags : [],
      } as unknown as Recipe
    },
    enabled: !!id,
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('recipes').delete().eq('id', id!)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes', profile?.household_id] })
      toast({ title: 'Recipe deleted' })
      navigate('/recipes')
    },
  })

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>
  if (!recipe) return <p>Recipe not found.</p>

  const totalMins = (recipe.prep_time_mins ?? 0) + (recipe.cook_time_mins ?? 0)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigate('/recipes')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/recipes/${id}/edit`}><Edit2 className="mr-2 h-3.5 w-3.5" />Edit</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)} className="text-destructive">
            <Trash2 className="mr-2 h-3.5 w-3.5" />Delete
          </Button>
        </div>
      </div>

      {recipe.image_url && (
        <div className="aspect-video overflow-hidden rounded-lg">
          <img src={recipe.image_url} alt={recipe.title} className="h-full w-full object-cover" />
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold">{recipe.title}</h1>
        {recipe.description && <p className="mt-2 text-muted-foreground">{recipe.description}</p>}
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
          {totalMins > 0 && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {recipe.prep_time_mins ? `${recipe.prep_time_mins}m prep` : ''}
              {recipe.prep_time_mins && recipe.cook_time_mins ? ' + ' : ''}
              {recipe.cook_time_mins ? `${recipe.cook_time_mins}m cook` : ''}
            </span>
          )}
          {recipe.servings && (
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {recipe.servings} servings
            </span>
          )}
        </div>
        {recipe.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Tag className="h-4 w-4 text-muted-foreground" />
            {recipe.tags.map((tag) => (
              <Badge key={tag} variant="secondary">{tag}</Badge>
            ))}
          </div>
        )}
      </div>

      <Separator />

      <div>
        <h2 className="mb-3 text-xl font-semibold">Ingredients</h2>
        <ul className="space-y-1.5">
          {recipe.ingredients.map((ing, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="font-medium">{ing.amount} {ing.unit}</span>
              <span>{ing.name}</span>
            </li>
          ))}
        </ul>
      </div>

      <Separator />

      <div>
        <h2 className="mb-3 text-xl font-semibold">Instructions</h2>
        <ol className="space-y-4">
          {recipe.instructions.map((ins) => (
            <li key={ins.step} className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {ins.step}
              </span>
              <p className="pt-0.5 text-sm leading-relaxed">{ins.text}</p>
            </li>
          ))}
        </ol>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete recipe?"
        description={`"${recipe.title}" will be permanently deleted.`}
        confirmLabel="Delete"
        onConfirm={() => deleteMutation.mutate()}
        destructive
      />
    </div>
  )
}
