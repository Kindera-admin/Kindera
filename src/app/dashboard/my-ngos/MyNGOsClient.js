'use client';

import { HeartHandshake, MapPin, CalendarDays } from 'lucide-react';
import { cldImage } from '@/lib/cloudinary';
import { Card, CardContent } from '@/components/ui/card';

// Read-only: Kindera staff add and edit these NGOs, so there are no controls here.
export default function MyNGOsClient({ partners, error }) {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My NGOs</h1>
        <p className="text-gray-600">The NGOs Kindera works with on behalf of your company.</p>
      </div>

      {error ? (
        <div role="alert" className="text-center py-16 text-red-600">
          <p className="text-sm">{error}</p>
        </div>
      ) : partners.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <HeartHandshake className="w-10 h-10 mx-auto mb-3 opacity-40" aria-hidden="true" />
          <p className="text-lg">Your company has no NGOs yet. Kindera adds them for you — contact your Kindera team.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {partners.map((ngo) => (
            <Card key={ngo._id} className="hover:shadow-lg transition-shadow overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 flex flex-col md:flex-row items-center md:items-start gap-6 border-b">
                {ngo.logoUrl && (
                  <div className="w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-white shadow-sm flex items-center justify-center p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cldImage(ngo.logoUrl, 240)} loading="lazy" decoding="async" alt={`${ngo.name} logo`} className="w-full h-full object-contain" />
                  </div>
                )}
                <div className="flex-1 min-w-0 text-center md:text-left">
                  <h2 className="text-2xl font-bold text-blue-900 mb-2 break-words">{ngo.name}</h2>
                  {(ngo.registeredOffice || ngo.location) && (
                    <p className="text-blue-700 font-medium inline-flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
                      {ngo.registeredOffice ? `Registered Office: ${ngo.registeredOffice}` : `Location: ${ngo.location}`}
                    </p>
                  )}
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-blue-800 shadow-sm">
                  <CalendarDays className="w-4 h-4" aria-hidden="true" />
                  {ngo.upcomingEvents} upcoming {ngo.upcomingEvents === 1 ? 'event' : 'events'}
                </span>
              </div>
              <CardContent className="pt-6">
                <p className="text-gray-700 mb-4 leading-relaxed whitespace-pre-wrap">{ngo.description}</p>

                {ngo.programs && ngo.programs.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-semibold text-gray-900 mb-2">Programs:</h3>
                    <ul className="space-y-2">
                      {ngo.programs.map((program, idx) => (
                        <li key={idx} className="flex items-start">
                          <span className="text-blue-600 mr-2" aria-hidden="true">•</span>
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
                    <h3 className="font-semibold text-green-900 mb-2">Impact:</h3>
                    <p className="text-green-800">{ngo.impact}</p>
                  </div>
                )}

                {ngo.website && (
                  <a
                    href={ngo.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm mt-4 block break-all"
                  >
                    {ngo.website}
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
