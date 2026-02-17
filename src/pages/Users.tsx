import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logSystemEvent } from '@/lib/systemLogger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Users as UsersIcon, Search, Shield, UserCheck, UserX, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Profile, AppRole } from '@/types/database';

interface UserWithRole extends Profile {
  role: AppRole | null;
}

export default function Users() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleChangeDialog, setRoleChangeDialog] = useState<{
    open: boolean;
    user: UserWithRole | null;
    newRole: AppRole | null;
  }>({ open: false, user: null, newRole: null });

  // Fetch all users with their roles
  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, username, full_name, is_active, failed_login_attempts, locked_until, force_password_change, two_factor_enabled, two_factor_verified_at, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles for all users
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Combine profiles with roles
      const usersWithRoles: UserWithRole[] = (profiles || []).map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.user_id);
        return {
          ...profile,
          role: (userRole?.role as AppRole) || null,
        };
      });

      return usersWithRoles;
    },
  });

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole, username, oldRole }: { userId: string; newRole: AppRole; username: string; oldRole: AppRole | null }) => {
      // First, delete existing role
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // Then insert new role
      const { error: insertError } = await supabase.from('user_roles').insert({
        user_id: userId,
        role: newRole,
        granted_by: user?.id,
      });

      if (insertError) throw insertError;

      // Log role change
      await logSystemEvent({
        eventType: 'role_changed',
        description: `Role changed for ${username}: ${oldRole || 'none'} → ${newRole}`,
        metadata: { targetUserId: userId, username, oldRole, newRole },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User role updated successfully');
      setRoleChangeDialog({ open: false, user: null, newRole: null });
    },
    onError: (error) => {
      toast.error('Failed to update role: ' + error.message);
    },
  });

  // Toggle user active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ userId, isActive, username }: { userId: string; isActive: boolean; username: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: isActive })
        .eq('user_id', userId);

      if (error) throw error;

      // Log activation/deactivation
      await logSystemEvent({
        eventType: isActive ? 'user_activated' : 'user_deactivated',
        description: `User ${username} was ${isActive ? 'activated' : 'deactivated'}`,
        metadata: { targetUserId: userId, username, isActive },
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(variables.isActive ? 'User activated' : 'User deactivated');
    },
    onError: (error) => {
      toast.error('Failed to update user status: ' + error.message);
    },
  });

  // Filter users based on search
  const filteredUsers = users?.filter(
    (u) =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadgeVariant = (role: AppRole | null) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'operator':
        return 'default';
      case 'student':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const handleRoleChange = (targetUser: UserWithRole, newRole: AppRole) => {
    // Prevent changing own role
    if (targetUser.user_id === user?.id) {
      toast.error("You cannot change your own role");
      return;
    }
    setRoleChangeDialog({ open: true, user: targetUser, newRole });
  };

  const confirmRoleChange = () => {
    if (roleChangeDialog.user && roleChangeDialog.newRole) {
      updateRoleMutation.mutate({
        userId: roleChangeDialog.user.user_id,
        newRole: roleChangeDialog.newRole,
        username: roleChangeDialog.user.username,
        oldRole: roleChangeDialog.user.role,
      });
    }
  };

  const handleToggleActive = (targetUser: UserWithRole) => {
    // Prevent deactivating self
    if (targetUser.user_id === user?.id) {
      toast.error("You cannot deactivate your own account");
      return;
    }
    toggleActiveMutation.mutate({
      userId: targetUser.user_id,
      isActive: !targetUser.is_active,
      username: targetUser.username,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground">Manage users, roles, and account status</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="h-5 w-5" />
              Users ({filteredUsers?.length || 0})
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers && filteredUsers.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.id} className={!u.is_active ? 'opacity-60' : ''}>
                      <TableCell className="font-medium">
                        {u.username}
                        {u.user_id === user?.id && (
                          <Badge variant="outline" className="ml-2">
                            You
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{u.full_name || '-'}</TableCell>
                      <TableCell>
                        <Select
                          value={u.role || ''}
                          onValueChange={(value) => handleRoleChange(u, value as AppRole)}
                          disabled={u.user_id === user?.id}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue>
                              <Badge variant={getRoleBadgeVariant(u.role)}>
                                {u.role || 'No Role'}
                              </Badge>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">
                              <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-destructive" />
                                Admin
                              </div>
                            </SelectItem>
                            <SelectItem value="operator">
                              <div className="flex items-center gap-2">
                                <UserCheck className="h-4 w-4 text-primary" />
                                Operator
                              </div>
                            </SelectItem>
                            <SelectItem value="student">
                              <div className="flex items-center gap-2">
                                <UsersIcon className="h-4 w-4 text-muted-foreground" />
                                Student
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.is_active ? 'default' : 'secondary'}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        {u.locked_until && new Date(u.locked_until) > new Date() && (
                          <Badge variant="destructive" className="ml-2">
                            Locked
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant={u.is_active ? 'outline' : 'default'}
                              size="sm"
                              disabled={u.user_id === user?.id}
                            >
                              {u.is_active ? (
                                <>
                                  <UserX className="mr-1 h-4 w-4" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <UserCheck className="mr-1 h-4 w-4" />
                                  Activate
                                </>
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {u.is_active ? 'Deactivate' : 'Activate'} User?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {u.is_active
                                  ? `This will prevent ${u.username} from accessing the system. They can be reactivated later.`
                                  : `This will restore ${u.username}'s access to the system.`}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleToggleActive(u)}>
                                {u.is_active ? 'Deactivate' : 'Activate'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <UsersIcon className="mx-auto h-16 w-16 opacity-50" />
              <p className="mt-4">No users found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role Change Confirmation Dialog */}
      <Dialog
        open={roleChangeDialog.open}
        onOpenChange={(open) =>
          setRoleChangeDialog({ open, user: null, newRole: null })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to change{' '}
              <strong>{roleChangeDialog.user?.username}</strong>'s role from{' '}
              <Badge variant={getRoleBadgeVariant(roleChangeDialog.user?.role || null)}>
                {roleChangeDialog.user?.role || 'No Role'}
              </Badge>{' '}
              to{' '}
              <Badge variant={getRoleBadgeVariant(roleChangeDialog.newRole)}>
                {roleChangeDialog.newRole}
              </Badge>
              ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRoleChangeDialog({ open: false, user: null, newRole: null })}
            >
              Cancel
            </Button>
            <Button onClick={confirmRoleChange} disabled={updateRoleMutation.isPending}>
              {updateRoleMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
