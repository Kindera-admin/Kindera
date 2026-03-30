import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import HomeButtons from '@/components/HomeButtons';

export default async function Home() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login');
  }
  
  return (
    <div className="w-full max-w-4xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-center px-4">NGO Impact Reporting System</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {user.role === 'ngo' && (
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Submit Monthly Report</CardTitle>
              <CardDescription>
                Report your NGO&apos;s monthly impact metrics
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col h-full">
              <p className="mb-4 flex-grow">
                Submit data about the number of people helped, events conducted,
                and funds utilized during the month.
              </p>
              <HomeButtons route="/reports/submit" label="Submit Report" />
            </CardContent>
          </Card>
        )}
        
        <Card className="h-full">
          <CardHeader>
            <CardTitle>View Reports</CardTitle>
            <CardDescription>
              {user.role === 'admin' ? 'View reports from all NGOs' : 'View your submitted reports'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col h-full">
            <p className="mb-4 flex-grow">
              {user.role === 'admin' 
                ? 'Access and manage reports submitted by all NGOs.'
                : 'Review and edit your previously submitted reports.'
              }
            </p>
            <HomeButtons route="/reports" label="View Reports" />
          </CardContent>
        </Card>
        
        {user.role === 'admin' && (
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Dashboard</CardTitle>
              <CardDescription>
                View aggregated impact metrics
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col h-full">
              <p className="mb-4 flex-grow">
                See total numbers for people helped, events conducted, and
                funds utilized across all NGOs.
              </p>
              <HomeButtons route="/dashboard" label="Go to Dashboard" />
            </CardContent>
          </Card>
        )}
        
        {user.role === 'admin' && (
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Manage Users</CardTitle>
              <CardDescription>
                Administer system users
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col h-full">
              <p className="mb-4 flex-grow">
                Register new users, manage existing accounts, and control access to the system.
              </p>
              <HomeButtons route="/admin/users" label="Manage Users" />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}