import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function NGOPartnersPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login');
  }
  
  // Only org users can access this page
  const isOrgUser = user.role === 'org_spoc' || user.role === 'org_member';
  if (!isOrgUser) {
    redirect('/home');
  }
  
  const ngoPartners = [
    {
      id: 1,
      name: "Anukulan",
      description: "A social initiative established in 2015. In special consultative status at the United Nations Economic and Social Council since 2022.",
      focusAreas: "Education, Environment Community, DEI for the benefit of underserved children, Youth, women, PWD, Elderly Care, children with visual and hearing impairments.",
      impact: "Till today we are able to benefit more than 1 million underserved through our various programs led by our team and also involving volunteers across the Globe.",
      location: "New Delhi",
      registeredOffice: "New Delhi"
    },
    {
      id: 2,
      name: "Jeevan Marga Charitable Trust",
      description: "Jeevan Marga mainly focused on 5 thematic areas:",
      programs: [
        "Education - Nanna Shaale Sikshana (My School Education)",
        "WASH and MHM Arogyada",
        "Asha Kirana - Entrepreneurship program",
        "Organizing, Leadership and Livelihood training for women",
        "Environment and Climate Action - Rejuvenation of water bodies"
      ],
      location: "Bangalore",
      registeredOffice: "Bangalore"
    },
    {
      id: 3,
      name: "Gully Classes Foundation",
      description: "Working on environmental conservation and community cleanliness.",
      focusAreas: "Beach/River cleanups",
      location: "Mumbai",
      registeredOffice: "Mumbai"
    },
    {
      id: 4,
      name: "Government Schools Across India",
      description: "Partnership with government schools across India for educational initiatives and infrastructure development.",
      focusAreas: "Education, Infrastructure, Student Support",
      location: "Pan India"
    },
    {
      id: 5,
      name: "Orphanages",
      description: "Supporting children's homes and orphanages with care, education, and development programs.",
      focusAreas: "Child Welfare, Education, Healthcare",
      location: "Various Locations"
    },
    {
      id: 6,
      name: "Elderly Homes",
      description: "Providing support and care services to senior citizens in elderly care facilities.",
      focusAreas: "Elderly Care, Healthcare, Social Support",
      location: "Various Locations"
    },
    {
      id: 7,
      name: "Children Residential Homes",
      description: "Supporting residential care facilities for children requiring special care and attention.",
      focusAreas: "Child Welfare, Education, Residential Care",
      location: "Various Locations"
    }
  ];
  
  return (
    <div className="w-full max-w-6xl mx-auto px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Our NGO Partners</h1>
        <p className="text-gray-600">
          Kindera collaborates with these remarkable organizations to create meaningful impact in communities across India.
        </p>
      </div>
      
      <div className="grid gap-6">
        {ngoPartners.map((ngo) => (
          <Card key={ngo.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100">
              <CardTitle className="text-2xl text-blue-900">{ngo.name}</CardTitle>
              {ngo.registeredOffice && (
                <CardDescription className="text-blue-700 font-medium">
                  📍 Registered Office: {ngo.registeredOffice}
                </CardDescription>
              )}
              {ngo.location && !ngo.registeredOffice && (
                <CardDescription className="text-blue-700 font-medium">
                  📍 Location: {ngo.location}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-gray-700 mb-4 leading-relaxed">{ngo.description}</p>
              
              {ngo.programs && (
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
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="mt-12 p-6 bg-blue-50 rounded-lg border border-blue-200">
        <h2 className="text-xl font-bold text-blue-900 mb-3">Want to Volunteer?</h2>
        <p className="text-blue-800 mb-4">
          These NGO partners regularly organize volunteering events. Check out the Events page to find upcoming opportunities 
          to make a difference in your community!
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
