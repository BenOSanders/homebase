import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  CheckSquare,
  Wrench,
  DollarSign,
  CalendarDays,
  BookOpen,
  Settings,
  Home,
  ChevronLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/chores', icon: CheckSquare, label: 'Chores' },
  { to: '/maintenance', icon: Wrench, label: 'Maintenance' },
  { to: '/budget', icon: DollarSign, label: 'Budget' },
  { to: '/meals', icon: CalendarDays, label: 'Meal Calendar' },
  { to: '/recipes', icon: BookOpen, label: 'Recipes' },
]

export function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUIStore()

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'fixed left-0 top-0 z-30 flex h-full flex-col border-r transition-all duration-200',
          'bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))]',
          sidebarOpen ? 'w-64' : 'w-16'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center border-b border-[hsl(var(--sidebar-border))] px-4">
          <div className={cn('flex items-center gap-3', !sidebarOpen && 'justify-center w-full')}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
              <Home className="h-4 w-4 text-white" />
            </div>
            {sidebarOpen && (
              <span className="text-lg font-bold tracking-tight">Homebase</span>
            )}
          </div>
        </div>

        {/* Nav */}
        <ScrollArea className="flex-1 py-4">
          <nav className="flex flex-col gap-1 px-2">
            {navItems.map(({ to, icon: Icon, label }) =>
              sidebarOpen ? (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      'hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]',
                      isActive
                        ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]'
                        : 'text-[hsl(var(--sidebar-foreground))]/70'
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </NavLink>
              ) : (
                <Tooltip key={to}>
                  <TooltipTrigger asChild>
                    <NavLink
                      to={to}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center justify-center rounded-md p-2 transition-colors',
                          'hover:bg-[hsl(var(--sidebar-accent))]',
                          isActive
                            ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]'
                            : 'text-[hsl(var(--sidebar-foreground))]/70'
                        )
                      }
                    >
                      <Icon className="h-5 w-5" />
                    </NavLink>
                  </TooltipTrigger>
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              )
            )}
          </nav>
        </ScrollArea>

        {/* Settings + Collapse */}
        <div className="border-t border-[hsl(var(--sidebar-border))] p-2">
          {sidebarOpen ? (
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  'hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]',
                  isActive
                    ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]'
                    : 'text-[hsl(var(--sidebar-foreground))]/70'
                )
              }
            >
              <Settings className="h-4 w-4 shrink-0" />
              Settings
            </NavLink>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <NavLink
                  to="/settings"
                  className={({ isActive }) =>
                    cn(
                      'flex items-center justify-center rounded-md p-2 transition-colors',
                      'hover:bg-[hsl(var(--sidebar-accent))]',
                      isActive
                        ? 'bg-[hsl(var(--sidebar-accent))]'
                        : 'text-[hsl(var(--sidebar-foreground))]/70'
                    )
                  }
                >
                  <Settings className="h-5 w-5" />
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className={cn(
              'mt-1 w-full text-[hsl(var(--sidebar-foreground))]/70 hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]',
              !sidebarOpen && 'flex items-center justify-center'
            )}
          >
            <ChevronLeft
              className={cn('h-4 w-4 transition-transform', !sidebarOpen && 'rotate-180')}
            />
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  )
}
