'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner'
import { registerForEvent, registerForEventLoggedIn } from '@/app/actions';
import { Loader2, Calendar, MapPin, Users, Info, Upload, UserCheck, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function EventRegisterClient({ event, currentUser }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);

  const isSpoc = currentUser?.role === 'org_spoc';
  const isOrgMember = currentUser?.role === 'org_member';
  const isGlobalEvent = !event.organizationName; // NGO or Admin event

  const { register, handleSubmit, formState: { errors }, watch } = useForm({
    defaultValues: {
      name: '', username: '', password: '',
      email: '', mobile: '', age: '',
      comment: '',
      volunteersCount: '1',
      volunteerNames: '',
    },
  });

  const volunteersCount = watch('volunteersCount');

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
      if (currentUser) {
        const result = await registerForEventLoggedIn(
          event._id,
          data.comment,
          isSpoc ? parseInt(data.volunteersCount) || 1 : 1,
          isSpoc ? data.volunteerNames : ''
        );
        if (result.success) {
          toast.success('Registration submitted!', {
            description: result.status === 'approved'
              ? 'Your registration is confirmed.'
              : 'Pending approval from the organiser.',
          });
          router.push('/events');
        } else {
          toast.error('Registration failed', { description: result.message });
        }
      } else {
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
          } catch {
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
      }
    } catch {
      toast.error('Registration failed', { description: 'An unexpected error occurred.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      weekday: 'short', year: 'numeric', month: 'long',
      day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const start = new Date(event.date);
  const end = new Date(start.getTime() + (event.durationHours || 2) * 60 * 60 * 1000);
  const isEnded = new Date() > end;

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-8">

      {/* Event Details Sidebar */}
      <div className="md:col-span-2 space-y-4">
        <Card className="border-emerald-100 shadow-sm bg-emerald-50/30 overflow-hidden">
          {event.imageUrl && (
            <div className="w-full h-40">
              <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
            </div>
          )}
          <CardHeader>
            <CardTitle className="text-xl text-[#0d3b26]">{event.title}</CardTitle>
            <CardDescription className="text-sm">
              {isGlobalEvent ? 'Open / Global Event' : 'Corporate Event'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-gray-700">{event.description}</p>
            <div className="pt-4 border-t border-emerald-100 space-y-2">
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

        {/* Info box */}
        {isSpoc && isGlobalEvent && (
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">
              As a <strong>Corporate SPOC</strong>, you are registering on behalf of your team.
              Specify how many employees you are sending and their names/notes below.
              The organiser will review and approve your group booking.
            </p>
          </div>
        )}

        {isOrgMember && isGlobalEvent && (
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              <strong>Your SPOC registers for global events</strong> on your team's behalf.
              Please contact your SPOC to be included in the registration for this event.
            </p>
          </div>
        )}

        {!isOrgMember && !isSpoc && currentUser && (
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">
              Your registration will be sent to the event organiser for approval.
            </p>
          </div>
        )}
      </div>

      {/* Registration Form */}
      <div className="md:col-span-3">
        {isEnded ? (
          <Card className="shadow-lg border-0 ring-1 ring-gray-100 h-full flex items-center justify-center p-8 text-center">
            <div>
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Registration Closed</h3>
              <p className="text-gray-500">This event has already ended.</p>
            </div>
          </Card>

        ) : isOrgMember && isGlobalEvent ? (
          /* Org Members cannot register for global events */
          <Card className="shadow-lg border-0 ring-1 ring-amber-100 h-full flex items-center justify-center p-8 text-center">
            <div>
              <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserCheck className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">SPOC Registration Required</h3>
              <p className="text-gray-500 mb-6 max-w-sm mx-auto text-sm">
                For global events, your <strong>Corporate SPOC</strong> registers on behalf of your team
                and decides how many employees to send. Please reach out to your SPOC.
              </p>
              <Button
                onClick={() => router.push('/messages')}
                className="bg-[#0d3b26] hover:bg-[#1a5c3a] text-white"
              >
                Message Your SPOC
              </Button>
            </div>
          </Card>

        ) : (
          <Card className="shadow-lg border-0 ring-1 ring-gray-100">
            <CardHeader>
              <CardTitle>
                {isSpoc && isGlobalEvent ? 'Group Registration' : 'Volunteer Details'}
              </CardTitle>
              <CardDescription>
                {isSpoc && isGlobalEvent
                  ? `Registering as SPOC for ${currentUser.organizationName || 'your organisation'}`
                  : currentUser
                    ? 'Confirm your registration below.'
                    : 'Fill in your details to register for this event'}
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit(onSubmit)}>
              <CardContent className="space-y-5">

                {currentUser ? (
                  <>
                    {/* SPOC group booking fields */}
                    {isSpoc && isGlobalEvent && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="volunteersCount">
                            Number of Employees Sending *
                          </Label>
                          <Input
                            id="volunteersCount"
                            type="number"
                            min="1"
                            max={event.capacity || 500}
                            placeholder="e.g. 10"
                            {...register('volunteersCount', {
                              required: 'Please enter the number of volunteers',
                              min: { value: 1, message: 'Must send at least 1 employee' }
                            })}
                          />
                          {errors.volunteersCount && (
                            <p className="text-xs text-red-500">{errors.volunteersCount.message}</p>
                          )}
                          <p className="text-xs text-gray-500">
                            How many employees from <strong>{currentUser.organizationName}</strong> will attend?
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="volunteerNames">
                            Employee Names / Notes (Optional)
                          </Label>
                          <textarea
                            id="volunteerNames"
                            className="w-full min-h-[90px] px-3 py-2 border rounded-md text-sm"
                            placeholder="e.g. John Smith, Priya Sharma, Rahul Gupta..."
                            {...register('volunteerNames')}
                          />
                          <p className="text-xs text-gray-500">
                            List names or add any notes for the organiser.
                          </p>
                        </div>

                        <div className="h-px bg-gray-100" />
                      </>
                    )}

                    {/* Comment / reason */}
                    <div className="space-y-2">
                      <Label htmlFor="comment">
                        {isSpoc && isGlobalEvent ? 'Message to Organiser (Optional)' : 'Why are you registering? (Optional)'}
                      </Label>
                      <textarea
                        id="comment"
                        className="w-full min-h-[80px] px-3 py-2 border rounded-md text-sm"
                        placeholder={isSpoc && isGlobalEvent
                          ? 'E.g. Our team specialises in community outreach...'
                          : 'E.g. I have experience with this kind of work...'}
                        {...register('comment')}
                      />
                    </div>

                    <p className="text-xs text-gray-500">
                      Registering as <strong>{currentUser.name}</strong>
                      {isSpoc && volunteersCount > 1 && (
                        <span> · Sending <strong>{volunteersCount} employees</strong></span>
                      )}
                    </p>
                  </>
                ) : (
                  /* Guest registration form */
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name *</Label>
                        <Input id="name" placeholder="Enter full name" {...register('name', { required: 'Name is required' })} />
                        {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="age">Age</Label>
                        <Input id="age" type="number" placeholder="Enter age" {...register('age')} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input id="email" type="email" placeholder="Enter email address" {...register('email')} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mobile">Phone Number *</Label>
                        <Input id="mobile" placeholder="Enter phone number" {...register('mobile', { required: 'Phone is required' })} />
                        {errors.mobile && <p className="text-xs text-red-500">{errors.mobile.message}</p>}
                      </div>
                    </div>

                    <div className="h-px bg-gray-100 my-2" />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="username">Choose Username *</Label>
                        <Input id="username" placeholder="Choose a username" {...register('username', { required: 'Username is required' })} />
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
                          type="file" accept="image/*"
                          onChange={e => setPhotoFile(e.target.files[0] || null)}
                          className="flex-1 text-sm file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                        />
                      </div>
                    </div>
                  </>
                )}
              </CardContent>

              <CardFooter className="flex flex-col gap-3">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#0d3b26] hover:bg-[#1a5c3a] text-white py-6 text-lg"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</span>
                  ) : isSpoc && isGlobalEvent
                    ? `Register ${volunteersCount || 1} Employee${parseInt(volunteersCount) > 1 ? 's' : ''}`
                    : 'Complete Registration'}
                </Button>
                {!currentUser && (
                  <p className="text-center text-sm text-gray-500">
                    Already have an account? <Link href="/login" className="text-[#0d3b26] font-medium hover:underline">Log in</Link>
                  </p>
                )}
              </CardFooter>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
