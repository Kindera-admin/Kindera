'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { registerForEvent } from '@/app/actions';
import { Loader2, Calendar, MapPin, Users, Info, Upload } from 'lucide-react';
import Link from 'next/link';

export default function EventRegisterClient({ event }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      name: '',
      username: '',
      password: '',
      email: '',
      mobile: '',
      age: '',
    },
  });

  const uploadPhoto = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', 'kindera/volunteers');
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!res.ok) throw new Error('Failed to upload photo');
    return (await res.json()).url;
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', data.name);
      formData.append('username', data.username);
      formData.append('password', data.password);
      formData.append('email', data.email);
      formData.append('mobile', data.mobile);
      formData.append('age', data.age);

      if (photoFile) {
        toast.loading('Uploading photo...', { id: 'photo-upload' });
        try {
          const url = await uploadPhoto(photoFile);
          formData.append('photoUrl', url);
          toast.dismiss('photo-upload');
        } catch (err) {
          toast.dismiss('photo-upload');
          toast.error('Failed to upload photo, proceeding without it');
        }
      }

      const result = await registerForEvent(formData, event._id);
      
      if (result.success) {
        toast.success('Registration successful!', {
          description: 'Your account is pending approval by the organizer.',
        });
        router.push('/pending');
      } else {
        toast.error('Registration failed', { description: result.message });
      }
    } catch (err) {
      toast.error('Registration failed', { description: 'An unexpected error occurred.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
      {/* Event Details Sidebar */}
      <div className="md:col-span-2 space-y-6">
        <Card className="border-emerald-100 shadow-sm bg-emerald-50/30 overflow-hidden">
          {event.imageUrl && (
            <div className="w-full h-40 relative">
              <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
            </div>
          )}
          <CardHeader>
            <CardTitle className="text-xl text-[#0d3b26]">{event.title}</CardTitle>
            <CardDescription className="text-sm">Register to volunteer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-700">{event.description}</p>
            
            <div className="space-y-3 pt-4 border-t border-emerald-100 text-sm">
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />
                <span className="text-gray-700">{formatDate(event.date)}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />
                <span className="text-gray-700">{event.location}</span>
              </div>
              {event.capacity && (
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />
                  <span className="text-gray-700">Capacity: {event.capacity} volunteers</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800">
            By registering, you are creating a Kindera volunteer account. 
            Your registration will be sent to the event organizer for approval.
          </p>
        </div>
      </div>

      {/* Registration Form */}
      <div className="md:col-span-3">
        <Card className="shadow-lg border-0 ring-1 ring-gray-100">
          <CardHeader>
            <CardTitle>Volunteer Details</CardTitle>
            <CardDescription>Fill in your details to register for this event</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-5">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input id="name" placeholder="John Doe" {...register('name', { required: 'Name is required' })} />
                  {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="age">Age</Label>
                  <Input id="age" type="number" placeholder="e.g. 25" {...register('age')} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" placeholder="john@example.com" {...register('email')} />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="mobile">Phone Number *</Label>
                  <Input id="mobile" placeholder="+91 9876543210" {...register('mobile', { required: 'Phone is required' })} />
                  {errors.mobile && <p className="text-xs text-red-500">{errors.mobile.message}</p>}
                </div>
              </div>

              <div className="h-px bg-gray-100 my-2" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Choose Username *</Label>
                  <Input id="username" placeholder="johndoe123" {...register('username', { required: 'Username is required' })} />
                  {errors.username && <p className="text-xs text-red-500">{errors.username.message}</p>}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Create Password *</Label>
                  <Input id="password" type="password" placeholder="••••••••" {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Min 6 chars' } })} />
                  {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Profile Photo (Optional)</Label>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">
                    {photoFile ? (
                      <img src={URL.createObjectURL(photoFile)} alt="Preview" className="h-full w-full object-cover" />
                    ) : (
                      <Upload className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <Input 
                    type="file" 
                    accept="image/*" 
                    onChange={e => setPhotoFile(e.target.files[0] || null)}
                    className="flex-1 text-sm file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                  />
                </div>
              </div>

            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" disabled={isSubmitting} className="w-full bg-[#0d3b26] hover:bg-[#1a5c3a] text-white py-6 text-lg">
                {isSubmitting ? (
                  <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Registering...</span>
                ) : 'Complete Registration'}
              </Button>
              <p className="text-center text-sm text-gray-500">
                Already have an account? <Link href="/login" className="text-[#0d3b26] font-medium hover:underline">Log in</Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
