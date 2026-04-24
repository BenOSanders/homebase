import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { SetupHouseholdPage } from '@/pages/auth/SetupHouseholdPage'
import { AppShell } from '@/components/layout/AppShell'
import { AuthGuard } from '@/components/shared/AuthGuard'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { ChoresPage } from '@/pages/chores/ChoresPage'
import { MaintenancePage } from '@/pages/maintenance/MaintenancePage'
import { BudgetPage } from '@/pages/budget/BudgetPage'
import { ImportPage } from '@/pages/budget/ImportPage'
import { MealCalendarPage } from '@/pages/meals/MealCalendarPage'
import { RecipesPage } from '@/pages/recipes/RecipesPage'
import { RecipeFormPage } from '@/pages/recipes/RecipeFormPage'
import { RecipeDetailPage } from '@/pages/recipes/RecipeDetailPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'
import { ProfileSettingsPage } from '@/pages/settings/ProfileSettingsPage'
import { HouseholdSettingsPage } from '@/pages/settings/HouseholdSettingsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/setup-household"
            element={
              <AuthGuard requireHousehold={false}>
                <SetupHouseholdPage />
              </AuthGuard>
            }
          />

          {/* Protected app routes */}
          <Route
            element={
              <AuthGuard>
                <AppShell />
              </AuthGuard>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/chores" element={<ChoresPage />} />
            <Route path="/maintenance" element={<MaintenancePage />} />
            <Route path="/budget" element={<BudgetPage />} />
            <Route path="/budget/import" element={<ImportPage />} />
            <Route path="/meals" element={<MealCalendarPage />} />
            <Route path="/recipes" element={<RecipesPage />} />
            <Route path="/recipes/new" element={<RecipeFormPage />} />
            <Route path="/recipes/:id" element={<RecipeDetailPage />} />
            <Route path="/recipes/:id/edit" element={<RecipeFormPage />} />
            <Route path="/settings" element={<SettingsPage />}>
              <Route index element={<ProfileSettingsPage />} />
              <Route path="profile" element={<ProfileSettingsPage />} />
              <Route path="household" element={<HouseholdSettingsPage />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
