import { useState, useCallback } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/hooks/use-toast'
import type { BudgetAccount } from '@/types'

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plaid`

async function callPlaid(token: string, action: string, payload: Record<string, unknown> = {}) {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Plaid request failed')
  return data
}

export function PlaidConnectButton() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function getLinkToken() {
    if (!session?.access_token) return
    setLoading(true)
    try {
      const data = await callPlaid(session.access_token, 'create_link_token')
      setLinkToken(data.link_token)
    } catch (err) {
      toast({ title: 'Plaid unavailable', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const onSuccess = useCallback(
    async (publicToken: string) => {
      if (!session?.access_token) return
      try {
        await callPlaid(session.access_token, 'exchange_public_token', {
          public_token: publicToken,
          account_name: 'Connected Account',
          account_type: 'checking',
        })
        queryClient.invalidateQueries({ queryKey: ['budget-accounts'] })
        toast({ title: 'Bank account connected!' })
      } catch (err) {
        toast({ title: 'Connection failed', description: (err as Error).message, variant: 'destructive' })
      }
    },
    [session, queryClient]
  )

  const { open, ready } = usePlaidLink({ token: linkToken ?? '', onSuccess })

  if (linkToken && ready) {
    return (
      <Button onClick={() => open()} variant="outline">
        <Link2 className="mr-2 h-4 w-4" />
        Connect Bank Account
      </Button>
    )
  }

  return (
    <Button onClick={getLinkToken} disabled={loading} variant="outline">
      {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
      Connect with Plaid
    </Button>
  )
}

export function PlaidSyncButton({ account }: { account: BudgetAccount }) {
  const { session } = useAuth()
  const queryClient = useQueryClient()

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!session?.access_token) throw new Error('Not authenticated')
      await callPlaid(session.access_token, 'sync_transactions', { account_id: account.id })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-transactions'] })
      toast({ title: 'Transactions synced' })
    },
    onError: (e: Error) => toast({ title: 'Sync failed', description: e.message, variant: 'destructive' }),
  })

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => syncMutation.mutate()}
      disabled={syncMutation.isPending}
    >
      <RefreshCw className={`mr-2 h-3.5 w-3.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
      Sync
    </Button>
  )
}
