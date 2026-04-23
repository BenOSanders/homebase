import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy, Check, UserMinus, Crown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useHousehold, useHouseholdMembers } from '@/hooks/useHousehold'
import { toast } from '@/hooks/use-toast'
import { getInitials } from '@/lib/utils'
import type { Profile } from '@/types'

export function HouseholdSettingsPage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const householdId = profile?.household_id ?? ''
  const { data: household } = useHousehold(householdId)
  const { data: members = [] } = useHouseholdMembers(householdId)

  const [copied, setCopied] = useState(false)
  const [householdName, setHouseholdName] = useState(household?.name ?? '')
  const [removeTarget, setRemoveTarget] = useState<Profile | null>(null)

  const isOwner = profile?.role === 'owner'

  function copyInviteLink() {
    if (!household) return
    navigator.clipboard.writeText(household.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({ title: 'Invite code copied!' })
  }

  const renameHouseholdMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('households')
        .update({ name: householdName.trim() })
        .eq('id', householdId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['household', householdId] })
      toast({ title: 'Household renamed' })
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ household_id: null, role: 'member' })
        .eq('id', memberId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['household-members', householdId] })
      toast({ title: 'Member removed' })
      setRemoveTarget(null)
    },
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Household</CardTitle>
          <CardDescription>Manage your household settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Household name</Label>
            <div className="flex gap-2">
              <Input
                value={householdName || household?.name || ''}
                onChange={(e) => setHouseholdName(e.target.value)}
                disabled={!isOwner}
              />
              {isOwner && (
                <Button
                  onClick={() => renameHouseholdMutation.mutate()}
                  disabled={!householdName.trim() || renameHouseholdMutation.isPending}
                >
                  Save
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Invite code</Label>
            <div className="flex items-center gap-2">
              <Input value={household?.invite_code ?? ''} readOnly className="font-mono tracking-widest" />
              <Button variant="outline" size="icon" onClick={copyInviteLink}>
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Share this code with household members to let them join.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>{members.length} member{members.length !== 1 ? 's' : ''} in this household.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {members.map((member) => (
              <li key={member.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={member.avatar_url ?? undefined} />
                    <AvatarFallback>{getInitials(member.display_name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">
                      {member.display_name}
                      {member.id === profile?.id && (
                        <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {member.role === 'owner' && (
                    <Badge variant="secondary">
                      <Crown className="mr-1 h-3 w-3" />Owner
                    </Badge>
                  )}
                  {isOwner && member.id !== profile?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setRemoveTarget(member)}
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(v) => !v && setRemoveTarget(null)}
        title={`Remove ${removeTarget?.display_name}?`}
        description="They will lose access to this household."
        confirmLabel="Remove"
        onConfirm={() => { if (removeTarget) removeMemberMutation.mutate(removeTarget.id) }}
        destructive
      />
    </div>
  )
}
