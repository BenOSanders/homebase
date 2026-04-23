import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    loading: true,
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState((s) => ({ ...s, session, user: session?.user ?? null }))
      if (session?.user) fetchProfile(session.user.id)
      else setState((s) => ({ ...s, loading: false }))
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((s) => ({ ...s, session, user: session?.user ?? null }))
      if (session?.user) fetchProfile(session.user.id)
      else setState((s) => ({ ...s, profile: null, loading: false }))
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setState((s) => ({ ...s, profile: data, loading: false }))
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return { ...state, signOut }
}
