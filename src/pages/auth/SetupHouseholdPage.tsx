import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Home, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'
import { generateInviteCode } from '@/lib/utils'

export function SetupHouseholdPage() {
  const navigate = useNavigate()
  const [householdName, setHouseholdName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)

  async function createHousehold() {
    if (!householdName.trim()) return
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const code = generateInviteCode()
    const { data: hh, error } = await supabase
      .from('households')
      .insert({ name: householdName.trim(), invite_code: code })
      .select()
      .single()

    if (error || !hh) {
      toast({ title: 'Error', description: error?.message ?? 'Failed to create household', variant: 'destructive' })
      setLoading(false)
      return
    }

    await supabase.from('profiles').upsert({
      id: user.id,
      household_id: hh.id,
      display_name: user.user_metadata?.display_name ?? user.email ?? 'User',
      role: 'owner',
    })

    navigate('/dashboard')
  }

  async function joinHousehold() {
    if (!inviteCode.trim()) return
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: hh, error } = await supabase
      .from('households')
      .select('id')
      .eq('invite_code', inviteCode.trim().toUpperCase())
      .single()

    if (error || !hh) {
      toast({ title: 'Invalid code', description: 'No household found with that invite code.', variant: 'destructive' })
      setLoading(false)
      return
    }

    await supabase.from('profiles').upsert({
      id: user.id,
      household_id: hh.id,
      display_name: user.user_metadata?.display_name ?? user.email ?? 'User',
      role: 'member',
    })

    navigate('/dashboard')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Home className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Set up your household</h1>
          <p className="text-sm text-muted-foreground">Create a new household or join an existing one.</p>
        </div>
        <Tabs defaultValue="create">
          <TabsList className="w-full">
            <TabsTrigger value="create" className="flex-1">
              <Home className="mr-2 h-4 w-4" />
              Create
            </TabsTrigger>
            <TabsTrigger value="join" className="flex-1">
              <Users className="mr-2 h-4 w-4" />
              Join
            </TabsTrigger>
          </TabsList>
          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle>New household</CardTitle>
                <CardDescription>Give your household a name and invite others later.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="household-name">Household name</Label>
                  <Input
                    id="household-name"
                    placeholder="The Smith Family"
                    value={householdName}
                    onChange={(e) => setHouseholdName(e.target.value)}
                  />
                </div>
                <Button onClick={createHousehold} disabled={loading || !householdName.trim()}>
                  {loading ? 'Creating…' : 'Create household'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="join">
            <Card>
              <CardHeader>
                <CardTitle>Join a household</CardTitle>
                <CardDescription>Enter the 8-character invite code shared by your household owner.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="invite-code">Invite code</Label>
                  <Input
                    id="invite-code"
                    placeholder="e.g. AB12CD34"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    maxLength={8}
                    className="uppercase tracking-widest"
                  />
                </div>
                <Button onClick={joinHousehold} disabled={loading || inviteCode.length < 8}>
                  {loading ? 'Joining…' : 'Join household'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
