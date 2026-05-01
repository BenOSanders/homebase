import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import Papa from 'papaparse'
import { Upload, ArrowLeft, Check, X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/utils'
import type { BudgetAccount } from '@/types'

interface ParsedRow {
  raw: Record<string, string>
  date: string
  description: string
  amount: number
  category: string
  valid: boolean
  error?: string
}

const REQUIRED_FIELDS = ['date', 'description', 'amount'] as const

export function ImportPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const householdId = profile?.household_id ?? ''
  const fileRef = useRef<HTMLInputElement>(null)

  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({
    date: '',
    description: '',
    amount: '',
    category: '',
  })
  const [accountId, setAccountId] = useState('')
  const [preview, setPreview] = useState<ParsedRow[]>([])
  const [step, setStep] = useState<'upload' | 'map' | 'preview'>('upload')

  const { data: accounts = [] } = useQuery({
    queryKey: ['budget-accounts', householdId],
    queryFn: async () => {
      const { data } = await supabase.from('budget_accounts').select('*').eq('household_id', householdId).order('name')
      return (data ?? []) as BudgetAccount[]
    },
    enabled: !!householdId,
  })

  function handleFile(file: File) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const hdrs = Object.keys((results.data[0] as Record<string, string>) ?? {})
        setHeaders(hdrs)
        setRows(results.data as Record<string, string>[])
        // Auto-map common header names
        const autoMap = { date: '', description: '', amount: '', category: '' }
        for (const h of hdrs) {
          const lower = h.toLowerCase()
          if (!autoMap.date && (lower.includes('date') || lower === 'posted')) autoMap.date = h
          if (!autoMap.description && (lower.includes('desc') || lower.includes('name') || lower === 'memo')) autoMap.description = h
          if (!autoMap.amount && (lower.includes('amount') || lower === 'debit' || lower === 'credit')) autoMap.amount = h
          if (!autoMap.category && lower.includes('categor')) autoMap.category = h
        }
        setMapping(autoMap)
        setStep('map')
      },
      error: () => toast({ title: 'Error parsing CSV', variant: 'destructive' }),
    })
  }

  function buildPreview() {
    const parsed: ParsedRow[] = rows.map((row) => {
      const dateRaw = row[mapping.date] ?? ''
      const desc = (row[mapping.description] ?? '').trim()
      const amtRaw = (row[mapping.amount] ?? '').replace(/[$,\s]/g, '')
      const cat = mapping.category ? (row[mapping.category] ?? '').trim() : ''

      const date = dateRaw ? new Date(dateRaw) : null
      const amount = parseFloat(amtRaw)

      const errors: string[] = []
      if (!date || isNaN(date.getTime())) errors.push('invalid date')
      if (!desc) errors.push('missing description')
      if (isNaN(amount)) errors.push('invalid amount')

      return {
        raw: row,
        date: date && !isNaN(date.getTime()) ? date.toISOString().split('T')[0] : '',
        description: desc,
        amount: isNaN(amount) ? 0 : amount,
        category: cat,
        valid: errors.length === 0,
        error: errors.join(', ') || undefined,
      }
    })
    setPreview(parsed)
    setStep('preview')
  }

  const importMutation = useMutation({
    mutationFn: async () => {
      const valid = preview.filter((r) => r.valid)
      const batch = valid.map((r) => ({
        household_id: householdId,
        description: r.description,
        amount: r.amount,
        date: r.date,
        category: r.category || null,
        account_id: accountId || null,
        source: 'csv' as const,
      }))
      const { error } = await supabase.from('budget_transactions').insert(batch)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-transactions'] })
      toast({ title: `Imported ${preview.filter((r) => r.valid).length} transactions` })
      navigate('/budget')
    },
    onError: (e: Error) => toast({ title: 'Import failed', description: e.message, variant: 'destructive' }),
  })

  const validCount = preview.filter((r) => r.valid).length

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/budget')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Import Transactions</h1>
          <p className="text-muted-foreground">Import from a CSV file exported from your bank.</p>
        </div>
      </div>

      {step === 'upload' && (
        <Card>
          <CardContent className="pt-6">
            <div
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-12 transition-colors hover:border-primary hover:bg-muted/30"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const file = e.dataTransfer.files[0]
                if (file?.name.endsWith('.csv')) handleFile(file)
              }}
            >
              <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Drop your CSV here or click to browse</p>
              <p className="mt-1 text-sm text-muted-foreground">Exports from most major banks are supported</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'map' && (
        <Card>
          <CardHeader><CardTitle>Map Columns</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Map your CSV columns to the correct fields. {rows.length} rows detected.
            </p>
            {REQUIRED_FIELDS.map((field) => (
              <div key={field} className="grid grid-cols-2 items-center gap-4">
                <Label className="capitalize">{field} *</Label>
                <Select value={mapping[field]} onValueChange={(v) => setMapping((m) => ({ ...m, [field]: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select column…" /></SelectTrigger>
                  <SelectContent>
                    {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div className="grid grid-cols-2 items-center gap-4">
              <Label>Category (optional)</Label>
              <Select value={mapping.category || '__none__'} onValueChange={(v) => setMapping((m) => ({ ...m, category: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {accounts.length > 0 && (
              <div className="grid grid-cols-2 items-center gap-4">
                <Label>Account (optional)</Label>
                <Select value={accountId || '__none__'} onValueChange={(v) => setAccountId(v === '__none__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="No account" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No account</SelectItem>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
              <Button
                onClick={buildPreview}
                disabled={!mapping.date || !mapping.description || !mapping.amount}
              >
                Preview
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'preview' && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Badge variant="success">{validCount} valid</Badge>
              {preview.length - validCount > 0 && (
                <Badge variant="destructive">{preview.length - validCount} errors</Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('map')}>Back</Button>
              <Button onClick={() => importMutation.mutate()} disabled={validCount === 0 || importMutation.isPending}>
                {importMutation.isPending ? 'Importing…' : `Import ${validCount} rows`}
              </Button>
            </div>
          </div>
          <div className="max-h-96 space-y-1 overflow-y-auto">
            {preview.slice(0, 100).map((row, i) => (
              <div key={i} className={`flex items-center justify-between rounded px-3 py-2 text-sm ${row.valid ? 'bg-muted/40' : 'bg-destructive/10'}`}>
                <div className="flex items-center gap-2">
                  {row.valid
                    ? <Check className="h-3.5 w-3.5 text-green-600" />
                    : <X className="h-3.5 w-3.5 text-destructive" />}
                  <span>{row.date}</span>
                  <span className="font-medium">{row.description}</span>
                  {row.category && <Badge variant="secondary" className="text-xs">{row.category}</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={row.amount >= 0 ? 'text-green-600' : 'text-destructive'}>
                    {formatCurrency(row.amount)}
                  </span>
                  {row.error && (
                    <span className="flex items-center gap-1 text-xs text-destructive">
                      <AlertTriangle className="h-3 w-3" />{row.error}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {preview.length > 100 && (
              <p className="text-center text-xs text-muted-foreground">…and {preview.length - 100} more rows</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
