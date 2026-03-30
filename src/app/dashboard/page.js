import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import HomeButtons from '@/components/HomeButtons';
import { getEvents } from '@/app/actions';

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  if (user.role === 'admin') {
    redirect('/admin');
  }

  const eventsResult = await getEvents('upcoming');
  const events = eventsResult.success ? eventsResult.events.slice(0, 3) : [];

  const isOrgUser = user.role === 'org_spoc' || user.role === 'org_member';

  return (
    <div className="w-full max-w-4xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-center px-4">
        Dashboard
      </h1>

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
        {user.role === 'ngo' && (
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Submit Monthly Report</CardTitle>
              <CardDescription>Report your NGO&apos;s monthly impact metrics</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col h-full">
              <p className="mb-4 flex-grow">
                Submit data about the number of people helped, events conducted, and funds utilized.
              </p>
              <HomeButtons route="/reports/submit" label="Submit Report" />
            </CardContent>
          </Card>
        )}

        {user.role === 'ngo' && (
          <Card className="h-full">
            <CardHeader>
              <CardTitle>View Reports</CardTitle>
              <CardDescription>View your submitted reports</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col h-full">
              <p className="mb-4 flex-grow">Review your previously submitted monthly reports.</p>
              <HomeButtons route="/reports" label="View Reports" />
            </CardContent>
          </Card>
        )}

        {(user.role === 'ngo' || isOrgUser) && (
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Events</CardTitle>
              <CardDescription>Browse and manage events</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col h-full">
              <p className="mb-4 flex-grow">
                {isOrgUser
                  ? 'Discover upcoming events and register through provided links.'
                  : 'Create and manage events for your organization.'}
              </p>
              <HomeButtons route="/events" label="View Events" />
            </CardContent>
          </Card>
        )}

        {isOrgUser && (
          <Card className="h-full">
            <CardHeader>
              <CardTitle>NGO Partners</CardTitle>
              <CardDescription>Meet our partner organizations</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col h-full">
              <p className="mb-4 flex-grow">
                Learn about the NGOs we collaborate with and their impactful work.
              </p>
              <HomeButtons route="/ngo-partners" label="View Partners" />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
