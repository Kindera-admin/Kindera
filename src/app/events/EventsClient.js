'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Users, ExternalLink, Trash2, Share2, CheckCircle2, Clock } from 'lucide-react';
import { deleteEvent } from '@/app/actions';
import { toast } from 'sonner';

export default function EventsClient({ events: initialEvents, userRole, currentUserId, approvedEventIds = [], pendingEventIds = [] }) {
  const [events, setEvents] = useState(initialEvents);
  const canCreateEvent = ['admin', 'ngo', 'org_spoc'].includes(userRole);
  const canRegisterForEvent = ['org_spoc', 'org_member', 'volunteer'].includes(userRole);
  const canDelete = userRole === 'admin';

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    const result = await deleteEvent(id);
    if (result.success) {
      setEvents(prev => prev.filter(e => e._id !== id));
      toast.success('Event deleted');
    } else {
      toast.error(result.message || 'Failed to delete event');
    }
  };

  const handleShare = (eventId) => {
    const url = `${window.location.origin}/events/${eventId}/register`;
    navigator.clipboard.writeText(url)
      .then(() => toast.success('Registration link copied to clipboard!'))
      .catch(() => toast.error('Failed to copy link'));
  };
  
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
  
  const getLifecycleBadge = (lifecycle) => {
    const badges = {
      upcoming: 'bg-blue-100 text-blue-800',
      live: 'bg-green-100 text-green-800',
      ended: 'bg-gray-100 text-gray-800'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badges[lifecycle] || badges.upcoming}`}>
        {lifecycle.charAt(0).toUpperCase() + lifecycle.slice(1)}
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
                    {getLifecycleBadge(event.lifecycle)}
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
                  
                  {event.durationHours && (
                    <div className="flex items-start gap-2">
                      <div className="w-4 h-4 mt-0.5 text-gray-500 flex items-center justify-center">⏳</div>
                      <div>
                        <div className="font-semibold">Duration</div>
                        <div className="text-gray-600">{event.durationHours} hours</div>
                      </div>
                    </div>
                  )}
                  
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
                  <Button
                    variant="outline"
                    onClick={() => handleShare(event._id)}
                    className="flex-1"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share Event
                  </Button>
                  
                  {userRole === 'org_spoc' && event.createdBy && event.createdBy._id === currentUserId ? (
                    <div className="flex-1 text-center py-2 px-4 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-100 flex items-center justify-center">
                      ✨ Created by you. You can ask your volunteers to participate.
                    </div>
                  ) : canRegisterForEvent && event.lifecycle !== 'ended' && (
                    approvedEventIds.includes(event._id) ? (
                      <Button
                        disabled
                        className="flex-1 bg-emerald-600 text-white cursor-default opacity-100"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Registered
                      </Button>
                    ) : pendingEventIds.includes(event._id) ? (
                      <Button
                        disabled
                        className="flex-1 bg-amber-500 text-white cursor-default opacity-100"
                      >
                        <Clock className="w-4 h-4 mr-2" />
                        Pending Approval
                      </Button>
                    ) : (
                      <Button
                        onClick={() => window.location.href = `/events/${event._id}/register`}
                        className="flex-1 bg-[#0d3b26] hover:bg-[#1a5c3a] text-white"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Register
                      </Button>
                    )
                  )}
                  {canDelete && (
                    <Button
                      variant="destructive"
                      onClick={() => handleDelete(event._id, event.title)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
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