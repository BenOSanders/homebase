export type { Database, Tables } from './database'

export interface Household {
  id: string
  name: string
  invite_code: string
  created_at: string
}

export interface Profile {
  id: string
  household_id: string | null
  display_name: string
  role: 'owner' | 'member'
  avatar_url: string | null
  created_at: string
}

export interface Chore {
  id: string
  household_id: string
  title: string
  description: string | null
  assigned_to: string | null
  recurrence: 'once' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | null
  due_date: string | null
  completed_at: string | null
  created_by: string | null
  created_at: string
  assignee?: Profile
}

export interface MaintenanceItem {
  id: string
  household_id: string
  title: string
  description: string | null
  category: string | null
  last_done: string | null
  next_due: string | null
  recurrence_months: number | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface BudgetAccount {
  id: string
  household_id: string
  name: string
  type: 'checking' | 'savings' | 'credit' | 'investment' | 'cash'
  plaid_item_id: string | null
  plaid_access_token: string | null
  balance: number | null
  last_synced_at: string | null
  created_at: string
}

export interface BudgetTransaction {
  id: string
  household_id: string
  account_id: string | null
  amount: number
  description: string
  category: string | null
  date: string
  source: 'manual' | 'csv' | 'plaid'
  plaid_transaction_id: string | null
  created_at: string
  account?: BudgetAccount
}

export interface BudgetCategory {
  id: string
  household_id: string
  name: string
  budget_amount: number | null
  color: string
  created_at: string
}

export interface RecipeIngredient {
  name: string
  amount: string
  unit: string
}

export interface RecipeInstruction {
  step: number
  text: string
}

export interface Recipe {
  id: string
  household_id: string
  title: string
  description: string | null
  servings: number | null
  prep_time_mins: number | null
  cook_time_mins: number | null
  ingredients: RecipeIngredient[]
  instructions: RecipeInstruction[]
  tags: string[]
  image_url: string | null
  created_by: string | null
  created_at: string
}

export interface MealPlan {
  id: string
  household_id: string
  date: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  recipe_id: string | null
  custom_name: string | null
  notes: string | null
  created_at: string
  recipe?: Recipe
}

export const MAINTENANCE_CATEGORIES = [
  'HVAC',
  'Plumbing',
  'Electrical',
  'Exterior',
  'Appliances',
  'Landscaping',
  'Roofing',
  'Windows & Doors',
  'Safety',
  'Other',
] as const

export type MaintenanceCategory = (typeof MAINTENANCE_CATEGORIES)[number]

export const CHORE_RECURRENCE_OPTIONS = [
  { value: 'once', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 Weeks' },
  { value: 'monthly', label: 'Monthly' },
] as const

export const TRANSACTION_SOURCES = ['manual', 'csv', 'plaid'] as const
export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export const ACCOUNT_TYPES = ['checking', 'savings', 'credit', 'investment', 'cash'] as const
