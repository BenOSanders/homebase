export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      households: {
        Row: {
          id: string
          name: string
          invite_code: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          invite_code?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          invite_code?: string
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          household_id: string | null
          display_name: string
          role: 'owner' | 'member'
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          household_id?: string | null
          display_name: string
          role?: 'owner' | 'member'
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string | null
          display_name?: string
          role?: 'owner' | 'member'
          avatar_url?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'profiles_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          }
        ]
      }
      chores: {
        Row: {
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
        }
        Insert: {
          id?: string
          household_id: string
          title: string
          description?: string | null
          assigned_to?: string | null
          recurrence?: 'once' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | null
          due_date?: string | null
          completed_at?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          title?: string
          description?: string | null
          assigned_to?: string | null
          recurrence?: 'once' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | null
          due_date?: string | null
          completed_at?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'chores_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'chores_assigned_to_fkey'
            columns: ['assigned_to']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'chores_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      maintenance_items: {
        Row: {
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
        Insert: {
          id?: string
          household_id: string
          title: string
          description?: string | null
          category?: string | null
          last_done?: string | null
          next_due?: string | null
          recurrence_months?: number | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          title?: string
          description?: string | null
          category?: string | null
          last_done?: string | null
          next_due?: string | null
          recurrence_months?: number | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'maintenance_items_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'maintenance_items_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      budget_accounts: {
        Row: {
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
        Insert: {
          id?: string
          household_id: string
          name: string
          type: 'checking' | 'savings' | 'credit' | 'investment' | 'cash'
          plaid_item_id?: string | null
          plaid_access_token?: string | null
          balance?: number | null
          last_synced_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          name?: string
          type?: 'checking' | 'savings' | 'credit' | 'investment' | 'cash'
          plaid_item_id?: string | null
          plaid_access_token?: string | null
          balance?: number | null
          last_synced_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'budget_accounts_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          }
        ]
      }
      budget_transactions: {
        Row: {
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
        }
        Insert: {
          id?: string
          household_id: string
          account_id?: string | null
          amount: number
          description: string
          category?: string | null
          date: string
          source?: 'manual' | 'csv' | 'plaid'
          plaid_transaction_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          account_id?: string | null
          amount?: number
          description?: string
          category?: string | null
          date?: string
          source?: 'manual' | 'csv' | 'plaid'
          plaid_transaction_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'budget_transactions_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'budget_transactions_account_id_fkey'
            columns: ['account_id']
            isOneToOne: false
            referencedRelation: 'budget_accounts'
            referencedColumns: ['id']
          }
        ]
      }
      budget_categories: {
        Row: {
          id: string
          household_id: string
          name: string
          budget_amount: number | null
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          name: string
          budget_amount?: number | null
          color?: string
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          name?: string
          budget_amount?: number | null
          color?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'budget_categories_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          }
        ]
      }
      recipes: {
        Row: {
          id: string
          household_id: string
          title: string
          description: string | null
          servings: number | null
          prep_time_mins: number | null
          cook_time_mins: number | null
          ingredients: Json
          instructions: Json
          tags: string[]
          image_url: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          title: string
          description?: string | null
          servings?: number | null
          prep_time_mins?: number | null
          cook_time_mins?: number | null
          ingredients?: Json
          instructions?: Json
          tags?: string[]
          image_url?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          title?: string
          description?: string | null
          servings?: number | null
          prep_time_mins?: number | null
          cook_time_mins?: number | null
          ingredients?: Json
          instructions?: Json
          tags?: string[]
          image_url?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'recipes_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'recipes_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      meal_plan: {
        Row: {
          id: string
          household_id: string
          date: string
          meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
          recipe_id: string | null
          custom_name: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          date: string
          meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
          recipe_id?: string | null
          custom_name?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          date?: string
          meal_type?: 'breakfast' | 'lunch' | 'dinner' | 'snack'
          recipe_id?: string | null
          custom_name?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'meal_plan_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'meal_plan_recipe_id_fkey'
            columns: ['recipe_id']
            isOneToOne: false
            referencedRelation: 'recipes'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
