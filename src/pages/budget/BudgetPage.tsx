import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { format, startOfMonth, endOfMonth, subMonths, addMonths, parseISO } from 'date-fns'
import { Plus, ChevronLeft, ChevronRight, Upload, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/utils'
import { ACCOUNT_TYPES } from '@/types'
import type { BudgetAccount, BudgetTransaction } from '@/types'

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6']

export function BudgetPage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const householdId = profile?.household_id ?? ''

  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [addTxOpen, setAddTxOpen] = useState(false)
  const [addAccountOpen, setAddAccountOpen] = useState(false)

  const [txForm, setTxForm] = useState({
    description: '',
    amount: '',
    category: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    account_id: '',
    type: 'expense' as 'expense' | 'income',
  })

  const [acctForm, setAcctForm] = useState({ name: '', type: 'checking' as BudgetAccount['type'] })

  const monthStart = format(startOfMonth(month), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(month), 'yyyy-MM-dd')

  const { data: accounts = [] } = useQuery({
    queryKey: ['budget-accounts', householdId],
    queryFn: async () => {
      const { data } = await supabase
        .from('budget_accounts')
        .select('*')
        .eq('household_id', householdId)
        .order('name')
      return (data ?? []) as BudgetAccount[]
    },
    enabled: !!householdId,
  })

  const { data: transactions = [] } = useQuery({
    queryKey: ['budget-transactions', householdId, monthStart],
    queryFn: async () => {
      const { data } = await supabase
        .from('budget_transactions')
        .select('*')
        .eq('household_id', householdId)
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date', { ascending: false })
      return (data ?? []) as BudgetTransaction[]
    },
    enabled: !!householdId,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['budget-categories', householdId],
    queryFn: async () => {
      const { data } = await supabase
        .from('budget_categories')
        .select('*')
        .eq('household_id', householdId)
        .order('name')
      return data ?? []
    },
    enabled: !!householdId,
  })

  const addTxMutation = useMutation({
    mutationFn: async () => {
      const amount = txForm.type === 'expense'
        ? -Math.abs(parseFloat(txForm.amount))
        : Math.abs(parseFloat(txForm.amount))
      const { error } = await supabase.from('budget_transactions').insert({
        household_id: householdId,
        description: txForm.description,
        amount,
        category: txForm.category || null,
        date: txForm.date,
        account_id: txForm.account_id || null,
        source: 'manual',
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-transactions', householdId, monthStart] })
      toast({ title: 'Transaction added' })
      setAddTxOpen(false)
      setTxForm({ description: '', amount: '', category: '', date: format(new Date(), 'yyyy-MM-dd'), account_id: '', type: 'expense' })
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const addAccountMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('budget_accounts').insert({
        household_id: householdId,
        name: acctForm.name,
        type: acctForm.type,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-accounts', householdId] })
      toast({ title: 'Account added' })
      setAddAccountOpen(false)
      setAcctForm({ name: '', type: 'checking' })
    },
  })

  // Compute summary
  const totalIncome = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const totalExpenses = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const net = totalIncome - totalExpenses

  // Category breakdown for pie
  const categoryTotals = transactions
    .filter((t) => t.amount < 0)
    .reduce((acc: Record<string, number>, t) => {
      const cat = t.category ?? 'Uncategorized'
      acc[cat] = (acc[cat] ?? 0) + Math.abs(t.amount)
      return acc
    }, {})
  const pieData = Object.entries(categoryTotals).map(([name, value]) => ({ name, value }))

  // Daily bar chart
  const dailyMap: Record<string, { income: number; expense: number }> = {}
  transactions.forEach((t) => {
    const d = t.date.slice(0, 10)
    if (!dailyMap[d]) dailyMap[d] = { income: 0, expense: 0 }
    if (t.amount > 0) dailyMap[d].income += t.amount
    else dailyMap[d].expense += Math.abs(t.amount)
  })
  const barData = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({ date: format(parseISO(date), 'MMM d'), ...vals }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budget</h1>
          <p className="text-muted-foreground">Track income and expenses.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/budget/import"><Upload className="mr-2 h-4 w-4" />Import CSV</Link>
          </Button>
          <Dialog open={addAccountOpen} onOpenChange={setAddAccountOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Link2 className="mr-2 h-4 w-4" />Add Account</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Account</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label>Account name</Label>
                  <Input placeholder="e.g. Chase Checking" value={acctForm.name} onChange={(e) => setAcctForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Type</Label>
                  <Select value={acctForm.type} onValueChange={(v) => setAcctForm((f) => ({ ...f, type: v as BudgetAccount['type'] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddAccountOpen(false)}>Cancel</Button>
                <Button onClick={() => addAccountMutation.mutate()} disabled={!acctForm.name || addAccountMutation.isPending}>
                  {addAccountMutation.isPending ? 'Adding…' : 'Add Account'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={addTxOpen} onOpenChange={setAddTxOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Add Transaction</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Transaction</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Type</Label>
                    <Select value={txForm.type} onValueChange={(v) => setTxForm((f) => ({ ...f, type: v as 'expense' | 'income' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Expense</SelectItem>
                        <SelectItem value="income">Income</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Amount *</Label>
                    <Input type="number" min={0} step={0.01} placeholder="0.00" value={txForm.amount} onChange={(e) => setTxForm((f) => ({ ...f, amount: e.target.value }))} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Description *</Label>
                  <Input placeholder="e.g. Grocery store" value={txForm.description} onChange={(e) => setTxForm((f) => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Category</Label>
                    <Select value={txForm.category} onValueChange={(v) => setTxForm((f) => ({ ...f, category: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Uncategorized</SelectItem>
                        {(categories as { id: string; name: string }[]).map((c) => (
                          <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Date</Label>
                    <Input type="date" value={txForm.date} onChange={(e) => setTxForm((f) => ({ ...f, date: e.target.value }))} />
                  </div>
                </div>
                {accounts.length > 0 && (
                  <div className="grid gap-2">
                    <Label>Account</Label>
                    <Select value={txForm.account_id} onValueChange={(v) => setTxForm((f) => ({ ...f, account_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="No account" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No account</SelectItem>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddTxOpen(false)}>Cancel</Button>
                <Button onClick={() => addTxMutation.mutate()} disabled={!txForm.description || !txForm.amount || addTxMutation.isPending}>
                  {addTxMutation.isPending ? 'Adding…' : 'Add'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => setMonth((m) => subMonths(m, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-36 text-center font-medium">{format(month, 'MMMM yyyy')}</span>
        <Button variant="outline" size="icon" onClick={() => setMonth((m) => addMonths(m, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Income</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Expenses</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-destructive">{formatCurrency(totalExpenses)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Net</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${net >= 0 ? 'text-green-600' : 'text-destructive'}`}>
              {formatCurrency(net)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions ({transactions.length})</TabsTrigger>
          <TabsTrigger value="accounts">Accounts ({accounts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-6">
          {barData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Daily Cash Flow</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(v) => formatCurrency(v as number)} />
                    <Bar dataKey="income" name="Income" fill="#22c55e" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="expense" name="Expenses" fill="#ef4444" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          {pieData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Expenses by Category</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip formatter={(v) => formatCurrency(v as number)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          {barData.length === 0 && pieData.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No transactions this month. Add one or import from CSV.</p>
          )}
        </TabsContent>

        <TabsContent value="transactions" className="mt-4">
          {transactions.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No transactions this month.</p>
          ) : (
            <div className="space-y-1">
              {transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-md border px-4 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{t.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{format(parseISO(t.date), 'MMM d')}</span>
                      {t.category && <Badge variant="secondary" className="text-xs">{t.category}</Badge>}
                      {t.source !== 'manual' && <Badge variant="outline" className="text-xs">{t.source}</Badge>}
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${t.amount >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                    {t.amount >= 0 ? '+' : ''}{formatCurrency(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="accounts" className="mt-4">
          {accounts.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No accounts added yet.</p>
          ) : (
            <div className="space-y-2">
              {accounts.map((a) => (
                <Card key={a.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium">{a.name}</p>
                      <p className="text-sm capitalize text-muted-foreground">{a.type}</p>
                    </div>
                    <div className="text-right">
                      {a.balance != null && <p className="font-semibold">{formatCurrency(a.balance)}</p>}
                      {a.plaid_item_id && <Badge variant="success" className="text-xs">Connected</Badge>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
