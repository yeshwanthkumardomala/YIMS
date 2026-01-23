import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users as UsersIcon } from 'lucide-react';

export default function Users() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground">Manage users and roles</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5" />
            Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center text-muted-foreground">
            <UsersIcon className="mx-auto h-16 w-16 opacity-50" />
            <p className="mt-4">User management coming soon</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
