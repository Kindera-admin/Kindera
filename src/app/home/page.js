import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import HomeButtons from '@/components/HomeButtons';
import { getEvents } from '@/app/actions';

export default async function UserHome() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login');
  }
  
  // Get upcoming events
  const eventsResult = await getEvents('upcoming');
  const events = eventsResult.success ? eventsResult.events.slice(0, 3) : [];
  
  const canCreateEvent = ['admin', 'ngo', 'org_spoc'].includes(user.role);
  const isOrgUser = user.role === 'org_spoc' || user.role === 'org_member';
  
  return (
    <div className="w-full max-w-4xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-center px-4">
        Kindera Dashboard
      </h1>
      
      {/* Events Section for Organization Users */}
      {isOrgUser && events.length > 0 && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Upcoming Events</h2>
            <HomeButtons route="/events" label="View All Events" />
          </div>
          <div className="grid grid-cols-1 gap-4">
            {events.map((event) => (
              <Card key={event._id}>
                <CardHeader>
                  <CardTitle className="text-lg">{event.title}</CardTitle>
                  <CardDescription>
                    {new Date(event.date).toLocaleDateString('en-US', { 
                      weekday: 'short',
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric'
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-3">{event.description}</p>
                  <HomeButtons 
                    route={event.registrationLink}
                    label="Register Now"
                    external={true}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* NGO Report Submission */}
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
        
        {/* View Reports - Only for Admin and NGO */}
        {(user.role === 'admin' || user.role === 'ngo') && (
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
        )}
        
        {/* Dashboard for Admin */}
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
              <HomeButtons route="/admin" label="Go to Dashboard" />
            </CardContent>
          </Card>
        )}
        
        {/* Manage Users for Admin */}
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
        
        {/* Events Management */}
        {canCreateEvent && (
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Manage Events</CardTitle>
              <CardDescription>
                Create and manage events
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col h-full">
              <p className="mb-4 flex-grow">
                Create new events, view all events, and manage event registrations.
              </p>
              <HomeButtons route="/events" label="View Events" />
            </CardContent>
          </Card>
        )}
        
        {/* View Events for Organization Users */}
        {isOrgUser && (
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Browse Events</CardTitle>
              <CardDescription>
                Discover and register for events
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col h-full">
              <p className="mb-4 flex-grow">
                Browse all upcoming events and register through Google Forms.
              </p>
              <HomeButtons route="/events" label="Browse Events" />
            </CardContent>
          </Card>
        )}
        
        {/* NGO Partners for Organization Users */}
        {isOrgUser && (
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Our NGO Partners</CardTitle>
              <CardDescription>
                Meet our partner organizations
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col h-full">
              <p className="mb-4 flex-grow">
                Learn about the NGOs we collaborate with and their impactful work across India.
              </p>
              <HomeButtons route="/ngo-partners" label="View Partners" />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
