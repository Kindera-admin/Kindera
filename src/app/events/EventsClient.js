'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Users, ExternalLink } from 'lucide-react';

export default function EventsClient({ events, userRole }) {
  const canCreateEvent = ['admin', 'ngo', 'org_spoc'].includes(userRole);
  const canRegisterForEvent = ['org_spoc', 'org_member'].includes(userRole);
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const getStatusBadge = (status) => {
    const badges = {
      upcoming: 'bg-blue-100 text-blue-800',
      ongoing: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badges[status] || badges.upcoming}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };
  
  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Events</h1>
        {canCreateEvent && (
          <Button onClick={() => window.location.href = '/events/create'}>
            Create Event
          </Button>
        )}
      </div>
      
      {events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No events available at the moment.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {events.map((event) => (
            <Card key={event._id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-2">{event.title}</CardTitle>
                    {getStatusBadge(event.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <CardDescription className="text-base">
                  {event.description}
                </CardDescription>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 mt-0.5 text-gray-500" />
                    <div>
                      <div className="font-semibold">Date & Time</div>
                      <div className="text-gray-600">{formatDate(event.date)}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 mt-0.5 text-gray-500" />
                    <div>
                      <div className="font-semibold">Location</div>
                      <div className="text-gray-600">{event.location}</div>
                    </div>
                  </div>
                  
                  {event.capacity && (
                    <div className="flex items-start gap-2">
                      <Users className="w-4 h-4 mt-0.5 text-gray-500" />
                      <div>
                        <div className="font-semibold">Capacity</div>
                        <div className="text-gray-600">{event.capacity} participants</div>
                      </div>
                    </div>
                  )}
                  
                  {event.createdBy && (
                    <div className="flex items-start gap-2">
                      <div className="w-4 h-4 mt-0.5" />
                      <div>
                        <div className="font-semibold">Organized by</div>
                        <div className="text-gray-600">{event.createdBy.name}</div>
                      </div>
                    </div>
                  )}
                </div>
                
                {event.imageUrl && (
                  <div className="mt-4">
                    <img 
                      src={event.imageUrl} 
                      alt={event.title}
                      className="w-full h-48 object-cover rounded-md"
                    />
                  </div>
                )}
                
                <div className="pt-4 flex gap-3">
  {canRegisterForEvent && event.status === 'upcoming' && (
    <Button 
      onClick={() => window.open(event.registrationLink, '_blank')}
      className="flex-1"
    >
      <ExternalLink className="w-4 h-4 mr-2" />
      Register Now
    </Button>
  )}
</div>

              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}