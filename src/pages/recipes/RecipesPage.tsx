import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, BookOpen, Search, Clock, Users, Trash2, Edit2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/hooks/use-toast'
import type { Recipe } from '@/types'

function RecipeCard({
  recipe,
  onDelete,
}: {
  recipe: Recipe
  onDelete: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const totalMins = (recipe.prep_time_mins ?? 0) + (recipe.cook_time_mins ?? 0)

  return (
    <>
      <Card className="group overflow-hidden">
        {recipe.image_url && (
          <div className="aspect-video w-full overflow-hidden">
            <img
              src={recipe.image_url}
              alt={recipe.title}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          </div>
        )}
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <Link to={`/recipes/${recipe.id}`} className="hover:underline">
              <h3 className="font-semibold">{recipe.title}</h3>
            </Link>
            <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                <Link to={`/recipes/${recipe.id}/edit`}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {recipe.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{recipe.description}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {totalMins > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {totalMins} min
              </span>
            )}
            {recipe.servings && (
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {recipe.servings} servings
              </span>
            )}
          </div>
          {recipe.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {recipe.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete recipe?"
        description={`"${recipe.title}" will be permanently deleted.`}
        confirmLabel="Delete"
        onConfirm={onDelete}
        destructive
      />
    </>
  )
}

export function RecipesPage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const householdId = profile?.household_id ?? ''
  const [search, setSearch] = useState('')

  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ['recipes', householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('household_id', householdId)
        .order('title')
      if (error) throw error
      return (data ?? []).map((r) => ({
        ...r,
        ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
        instructions: Array.isArray(r.instructions) ? r.instructions : [],
        tags: Array.isArray(r.tags) ? r.tags : [],
      })) as unknown as Recipe[]
    },
    enabled: !!householdId,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recipes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes', householdId] })
      toast({ title: 'Recipe deleted' })
    },
  })

  const filtered = recipes.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recipe Book</h1>
          <p className="text-muted-foreground">Your household's recipe collection.</p>
        </div>
        <Button asChild>
          <Link to="/recipes/new"><Plus className="mr-2 h-4 w-4" />New Recipe</Link>
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search recipes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={search ? 'No recipes found' : 'No recipes yet'}
          description={search ? 'Try a different search.' : 'Add your first recipe to build your collection.'}
          action={
            !search && (
              <Button asChild>
                <Link to="/recipes/new"><Plus className="mr-2 h-4 w-4" />Add Recipe</Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onDelete={() => deleteMutation.mutate(recipe.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
