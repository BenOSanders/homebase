import { useQuery } from '@tanstack/react-query'
import {
  CheckSquare,
  Wrench,
  DollarSign,
  CalendarDays,
  AlertTriangle,
  Clock,
  TrendingUp,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency, formatDate } from '@/lib/utils'
import { isAfter, parseISO, startOfMonth, endOfMonth } from 'date-fns'
import type { Chore, MaintenanceItem } from '@/types'

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  to,
  variant = 'default',
}: {
  title: string
  value: string | number
  description?: string
  icon: React.ElementType
  to: string
  variant?: 'default' | 'warning' | 'success'
}) {
  const colors = {
    default: 'text-primary',
    warning: 'text-destructive',
    success: 'text-green-600',
  }

  return (
    <Link to={to}>
      <Card className="cursor-pointer transition-shadow hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <Icon className={`h-5 w-5 ${colors[variant]}`} />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{value}</div>
          {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        </CardContent>
      </Card>
    </Link>
  )
}

export function DashboardPage() {
  const { profile } = useAuth()
  const householdId = profile?.household_id

  const { data: overdueChores = 0 } = useQuery({
    queryKey: ['dashboard-chores', householdId],
    queryFn: async () => {
      if (!householdId) return 0
      const today = new Date().toISOString().split('T')[0]
      const { count } = await supabase
        .from('chores')
        .select('id', { count: 'exact', head: true })
        .eq('household_id', householdId)
        .is('completed_at', null)
        .lt('due_date', today)
      return count ?? 0
    },
    enabled: !!householdId,
  })

  const { data: upcomingMaintenance = [] } = useQuery({
    queryKey: ['dashboard-maintenance', householdId],
    queryFn: async () => {
      if (!householdId) return []
      const in30 = new Date()
      in30.setDate(in30.getDate() + 30)
      const { data } = await supabase
        .from('maintenance_items')
        .select('*')
        .eq('household_id', householdId)
        .lte('next_due', in30.toISOString().split('T')[0])
        .order('next_due')
        .limit(5)
      return (data ?? []) as MaintenanceItem[]
    },
    enabled: !!householdId,
  })

  const { data: monthlySpend = 0 } = useQuery({
    queryKey: ['dashboard-budget', householdId],
    queryFn: async () => {
      if (!householdId) return 0
      const now = new Date()
      const start = startOfMonth(now).toISOString().split('T')[0]
      const end = endOfMonth(now).toISOString().split('T')[0]
      const { data } = await supabase
        .from('budget_transactions')
        .select('amount')
        .eq('household_id', householdId)
        .gte('date', start)
        .lte('date', end)
        .lt('amount', 0)
      const total = (data ?? []).reduce((sum, t: { amount: number }) => sum + Math.abs(t.amount), 0)
      return total
    },
    enabled: !!householdId,
  })

  const { data: mealsThisWeek = 0 } = useQuery({
    queryKey: ['dashboard-meals', householdId],
    queryFn: async () => {
      if (!householdId) return 0
      const today = new Date()
      const dayOfWeek = today.getDay()
      const monday = new Date(today)
      monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7))
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      const { count } = await supabase
        .from('meal_plan')
        .select('id', { count: 'exact', head: true })
        .eq('household_id', householdId)
        .gte('date', monday.toISOString().split('T')[0])
        .lte('date', sunday.toISOString().split('T')[0])
      return count ?? 0
    },
    enabled: !!householdId,
  })

  const { data: recentChores = [] } = useQuery({
    queryKey: ['dashboard-recent-chores', householdId],
    queryFn: async () => {
      if (!householdId) return []
      const { data } = await supabase
        .from('chores')
        .select('*')
        .eq('household_id', householdId)
        .is('completed_at', null)
        .order('due_date', { nullsFirst: false })
        .limit(5)
      return (data ?? []) as Chore[]
    },
    enabled: !!householdId,
  })

  const now = new Date()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back{profile?.display_name ? `, ${profile.display_name.split(' ')[0]}` : ''}!
        </h1>
        <p className="text-muted-foreground">Here's what's going on at home.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Overdue Chores"
          value={overdueChores}
          description="Tasks past due date"
          icon={CheckSquare}
          to="/chores"
          variant={overdueChores > 0 ? 'warning' : 'success'}
        />
        <StatCard
          title="Maintenance Due Soon"
          value={upcomingMaintenance.length}
          description="Within the next 30 days"
          icon={Wrench}
          to="/maintenance"
          variant={upcomingMaintenance.length > 0 ? 'warning' : 'default'}
        />
        <StatCard
          title="Spent This Month"
          value={formatCurrency(monthlySpend)}
          description={now.toLocaleString('default', { month: 'long', year: 'numeric' })}
          icon={DollarSign}
          to="/budget"
        />
        <StatCard
          title="Meals Planned"
          value={mealsThisWeek}
          description="This week"
          icon={CalendarDays}
          to="/meals"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Upcoming Chores */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Upcoming Chores</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/chores">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentChores.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending chores.</p>
            ) : (
              <ul className="space-y-3">
                {recentChores.map((chore) => {
                  const overdue = chore.due_date && isAfter(now, parseISO(chore.due_date))
                  return (
                    <li key={chore.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {overdue ? (
                          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                        ) : (
                          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="text-sm font-medium">{chore.title}</span>
                      </div>
                      {chore.due_date && (
                        <Badge variant={overdue ? 'destructive' : 'secondary'} className="shrink-0">
                          {formatDate(chore.due_date)}
                        </Badge>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Maintenance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Maintenance Schedule</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/maintenance">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {upcomingMaintenance.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming maintenance.</p>
            ) : (
              <ul className="space-y-3">
                {upcomingMaintenance.map((item) => {
                  const overdue =
                    item.next_due && isAfter(now, parseISO(item.next_due))
                  return (
                    <li key={item.id} className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        {item.category && (
                          <p className="text-xs text-muted-foreground">{item.category}</p>
                        )}
                      </div>
                      {item.next_due && (
                        <Badge variant={overdue ? 'destructive' : 'secondary'} className="shrink-0">
                          {formatDate(item.next_due)}
                        </Badge>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Access</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/chores"><CheckSquare className="mr-2 h-4 w-4" />Add Chore</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/maintenance"><Wrench className="mr-2 h-4 w-4" />Log Maintenance</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/budget"><TrendingUp className="mr-2 h-4 w-4" />Add Transaction</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/recipes/new"><CalendarDays className="mr-2 h-4 w-4" />New Recipe</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
