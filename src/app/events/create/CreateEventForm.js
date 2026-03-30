'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { createEvent } from '@/app/actions';
import { ImageIcon } from 'lucide-react';

export default function CreateEventForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm({
    defaultValues: {
      title: '',
      description: '',
      date: '',
      location: '',
      registrationLink: '',
      capacity: '',
      imageUrl: '',
    },
  });

  const imageUrl = watch('imageUrl');

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    
    try {
      const formData = new FormData();
      formData.append('title', data.title);
      formData.append('description', data.description);
      formData.append('date', data.date);
      formData.append('location', data.location);
      formData.append('registrationLink', data.registrationLink);
      if (data.capacity) formData.append('capacity', data.capacity);
      if (data.imageUrl) formData.append('imageUrl', data.imageUrl);
      
      const result = await createEvent(formData);
      
      if (result.success) {
        toast.success('Event Created', {
          description: 'The event has been created successfully.'
        });
        router.push('/events');
      } else {
        toast.error('Creation Failed', {
          description: result.message || 'An error occurred while creating the event.'
        });
      }
    } catch (error) {
      toast.error('Creation Failed', {
        description: 'An unexpected error occurred.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create New Event</h1>
      
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
          <CardDescription>
            Fill in the event information. Google Form link is required for registration.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Event Title *</Label>
              <Input
                id="title"
                className="w-full"
                placeholder="Enter event title"
                {...register('title', { required: 'Title is required' })}
              />
              {errors.title && (
                <p className="text-sm text-red-500">{errors.title.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <textarea
                id="description"
                className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                placeholder="Describe the event..."
                {...register('description', { required: 'Description is required' })}
              />
              {errors.description && (
                <p className="text-sm text-red-500">{errors.description.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="date">Date & Time *</Label>
              <Input
                id="date"
                type="datetime-local"
                className="w-full"
                {...register('date', { required: 'Date and time are required' })}
              />
              {errors.date && (
                <p className="text-sm text-red-500">{errors.date.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                className="w-full"
                placeholder="Event location or venue"
                {...register('location', { required: 'Location is required' })}
              />
              {errors.location && (
                <p className="text-sm text-red-500">{errors.location.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="registrationLink">Google Form Registration Link *</Label>
              <Input
                id="registrationLink"
                type="url"
                className="w-full"
                placeholder="https://forms.gle/..."
                {...register('registrationLink', { 
                  required: 'Registration link is required',
                  pattern: {
                    value: /^https?:\/\/.+/,
                    message: 'Please enter a valid URL'
                  }
                })}
              />
              {errors.registrationLink && (
                <p className="text-sm text-red-500">{errors.registrationLink.message}</p>
              )}
              <p className="text-xs text-gray-500">
                Paste your Google Form link here for event registration
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="capacity">Capacity (optional)</Label>
              <Input
                id="capacity"
                type="number"
                className="w-full"
                placeholder="Maximum number of participants"
                {...register('capacity', {
                  min: { value: 1, message: 'Capacity must be at least 1' }
                })}
              />
              {errors.capacity && (
                <p className="text-sm text-red-500">{errors.capacity.message}</p>
              )}
            </div>
            
            {/* ENHANCED IMAGE URL FIELD */}
            <div className="space-y-2">
              <Label htmlFor="imageUrl" className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Event Image (optional)
              </Label>
              <Input
                id="imageUrl"
                type="text"
                className="w-full"
                placeholder="/events/my-event.jpg or https://example.com/image.jpg"
                {...register('imageUrl')}
              />
              {errors.imageUrl && (
                <p className="text-sm text-red-500">{errors.imageUrl.message}</p>
              )}
              <div className="text-xs text-gray-500 space-y-1">
                <p>📁 For local images: Place in <code className="bg-gray-100 px-1 py-0.5 rounded">public/events/</code> and use <code className="bg-gray-100 px-1 py-0.5 rounded">/events/filename.jpg</code></p>
                <p>🌐 For external images: Use full URL starting with https://</p>
              </div>
              
              {/* IMAGE PREVIEW */}
              {imageUrl && (
                <div className="mt-3 border rounded-lg p-3 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Preview:</p>
                  <img 
                    src={imageUrl} 
                    alt="Event preview"
                    className="w-full h-48 object-cover rounded-md"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  <div className="hidden w-full h-48 items-center justify-center bg-gray-200 rounded-md">
                    <p className="text-sm text-gray-500">Invalid image URL</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-between gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => router.back()}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? 'Creating...' : 'Create Event'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}