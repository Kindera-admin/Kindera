import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getAllNGOPartners } from '@/app/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function NGOPartnersPage() {
  const user = await getCurrentUser();

  if (!user) redirect('/login');

  const isOrgUser = user.role === 'org_spoc' || user.role === 'org_member';
  if (!isOrgUser) redirect('/home');

  const { partners = [] } = await getAllNGOPartners();

  return (
    <div className="w-full max-w-6xl mx-auto px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Our NGO Partners</h1>
        <p className="text-gray-600">
          Kindera collaborates with these remarkable organizations to create meaningful impact in communities across India.
        </p>
      </div>

      {partners.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">No NGO partners have been added yet.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {partners.map((ngo) => (
            <Card key={ngo._id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100">
                <CardTitle className="text-2xl text-blue-900">{ngo.name}</CardTitle>
                {ngo.registeredOffice && (
                  <CardDescription className="text-blue-700 font-medium">
                    📍 Registered Office: {ngo.registeredOffice}
                  </CardDescription>
                )}
                {!ngo.registeredOffice && ngo.location && (
                  <CardDescription className="text-blue-700 font-medium">
                    📍 Location: {ngo.location}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-gray-700 mb-4 leading-relaxed">{ngo.description}</p>

                {ngo.programs && ngo.programs.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-semibold text-gray-900 mb-2">Programs:</h3>
                    <ul className="space-y-2">
                      {ngo.programs.map((program, idx) => (
                        <li key={idx} className="flex items-start">
                          <span className="text-blue-600 mr-2">•</span>
                          <span className="text-gray-700">{program}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {ngo.focusAreas && (
                  <div className="mb-4">
                    <h3 className="font-semibold text-gray-900 mb-2">Focus Areas:</h3>
                    <p className="text-gray-700">{ngo.focusAreas}</p>
                  </div>
                )}

                {ngo.impact && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h3 className="font-semibold text-green-900 mb-2">🌟 Impact:</h3>
                    <p className="text-green-800">{ngo.impact}</p>
                  </div>
                )}

                {ngo.website && (
                  <a
                    href={ngo.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm mt-4 block"
                  >
                    {ngo.website}
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-12 p-6 bg-blue-50 rounded-lg border border-blue-200">
        <h2 className="text-xl font-bold text-blue-900 mb-3">Want to Volunteer?</h2>
        <p className="text-blue-800 mb-4">
          These NGO partners regularly organize volunteering events. Check out the Events page to find upcoming
          opportunities to make a difference in your community!
        </p>
        <a
          href="/events"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          View Upcoming Events
        </a>
      </div>
    </div>
  );
}
