import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Household, Profile } from '@/types'

export function useHousehold(householdId: string | null | undefined) {
  return useQuery({
    queryKey: ['household', householdId],
    queryFn: async () => {
      if (!householdId) return null
      const { data, error } = await supabase
        .from('households')
        .select('*')
        .eq('id', householdId)
        .single()
      if (error) throw error
      return data as Household
    },
    enabled: !!householdId,
  })
}

export function useHouseholdMembers(householdId: string | null | undefined) {
  return useQuery({
    queryKey: ['household-members', householdId],
    queryFn: async () => {
      if (!householdId) return []
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at')
      if (error) throw error
      return (data ?? []) as Profile[]
    },
    enabled: !!householdId,
  })
}
