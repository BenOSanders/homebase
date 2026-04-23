// Supabase Edge Function: Plaid Integration
// Handles: create_link_token, exchange_public_token, sync_transactions
//
// Environment variables needed (set via `supabase secrets set`):
//   PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV (sandbox|development|production)
//
// Deploy: supabase functions deploy plaid

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PLAID_ENV = Deno.env.get('PLAID_ENV') ?? 'sandbox'
const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID') ?? ''
const PLAID_SECRET = Deno.env.get('PLAID_SECRET') ?? ''
const PLAID_BASE_URL = `https://${PLAID_ENV}.plaid.com`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function plaidRequest(endpoint: string, body: Record<string, unknown>) {
  const res = await fetch(`${PLAID_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: PLAID_CLIENT_ID, secret: PLAID_SECRET, ...body }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error_message ?? 'Plaid API error')
  }
  return res.json()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', user.id).single()
    if (!profile?.household_id) return new Response(JSON.stringify({ error: 'No household' }), { status: 400 })

    const { action, ...payload } = await req.json()

    if (action === 'create_link_token') {
      const data = await plaidRequest('/link/token/create', {
        user: { client_user_id: user.id },
        client_name: 'Homebase',
        products: ['transactions'],
        country_codes: ['US'],
        language: 'en',
      })
      return new Response(JSON.stringify({ link_token: data.link_token }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'exchange_public_token') {
      const { public_token, account_name, account_type } = payload
      const data = await plaidRequest('/item/public_token/exchange', { public_token })
      const { access_token, item_id } = data

      // Get account balances
      const balanceData = await plaidRequest('/accounts/balance/get', { access_token })
      const balance = balanceData.accounts?.[0]?.balances?.current ?? null

      await supabase.from('budget_accounts').insert({
        household_id: profile.household_id,
        name: account_name ?? 'Plaid Account',
        type: account_type ?? 'checking',
        plaid_item_id: item_id,
        plaid_access_token: access_token,
        balance,
        last_synced_at: new Date().toISOString(),
      })

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'sync_transactions') {
      const { account_id } = payload
      const { data: account } = await supabase
        .from('budget_accounts')
        .select('plaid_access_token')
        .eq('id', account_id)
        .eq('household_id', profile.household_id)
        .single()

      if (!account?.plaid_access_token) {
        return new Response(JSON.stringify({ error: 'Account not connected' }), { status: 400 })
      }

      const endDate = new Date().toISOString().split('T')[0]
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const txData = await plaidRequest('/transactions/get', {
        access_token: account.plaid_access_token,
        start_date: startDate,
        end_date: endDate,
      })

      const toInsert = txData.transactions.map((t: {
        transaction_id: string
        date: string
        name: string
        amount: number
        category?: string[]
      }) => ({
        household_id: profile.household_id,
        account_id,
        plaid_transaction_id: t.transaction_id,
        date: t.date,
        description: t.name,
        amount: -t.amount, // Plaid uses positive for debits
        category: t.category?.[0] ?? null,
        source: 'plaid',
      }))

      // Upsert to avoid duplicates
      const { error } = await supabase
        .from('budget_transactions')
        .upsert(toInsert, { onConflict: 'plaid_transaction_id', ignoreDuplicates: true })

      await supabase
        .from('budget_accounts')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', account_id)

      return new Response(JSON.stringify({ synced: toInsert.length, error: error?.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400 })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
