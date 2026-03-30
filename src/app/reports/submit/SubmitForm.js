'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { submitReport } from '@/app/actions';

export default function SubmitForm({ user }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      ngoId: user?.ngoId || '',
      month: new Date().toISOString().slice(0, 7), // Default to current month (YYYY-MM)
      peopleHelped: '',
      eventsConducted: '',
      fundsUtilized: '',
    },
  });

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    
    try {
      const formData = new FormData();
      formData.append('ngoId', data.ngoId);
      formData.append('month', data.month);
      formData.append('peopleHelped', data.peopleHelped);
      formData.append('eventsConducted', data.eventsConducted);
      formData.append('fundsUtilized', data.fundsUtilized);
      
      const result = await submitReport(formData);
      
      if (result.success) {
        toast.success('Report Submitted', {
          description: 'Your monthly report has been submitted successfully.'
        });
        router.push('/reports');
      } else {
        toast.error('Submission Failed', {
          description: result.message || 'An error occurred while submitting the report.'
        });
      }
    } catch (error) {
      toast.error('Submission Failed', {
        description: 'An unexpected error occurred.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Submit Monthly Report</CardTitle>
        <CardDescription>
          Report your NGO&apos;s impact metrics for the month
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="ngoId">NGO ID</Label>
            <Input
              id="ngoId"
              className="w-full"
              {...register('ngoId', { required: 'NGO ID is required' })}
              disabled={user.role === 'ngo'} // NGO users can't change their ID
            />
            {errors.ngoId && (
              <p className="text-sm text-red-500">{errors.ngoId.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="month">Month</Label>
            <Input
              id="month"
              type="month"
              className="w-full"
              {...register('month', { required: 'Month is required' })}
            />
            {errors.month && (
              <p className="text-sm text-red-500">{errors.month.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="peopleHelped">People Helped</Label>
            <Input
              id="peopleHelped"
              type="number"
              min="0"
              className="w-full"
              {...register('peopleHelped', { 
                required: 'This field is required',
                min: { value: 0, message: 'Value must be 0 or greater' },
                valueAsNumber: true
              })}
            />
            {errors.peopleHelped && (
              <p className="text-sm text-red-500">{errors.peopleHelped.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="eventsConducted">Events Conducted</Label>
            <Input
              id="eventsConducted"
              type="number"
              min="0"
              className="w-full"
              {...register('eventsConducted', { 
                required: 'This field is required',
                min: { value: 0, message: 'Value must be 0 or greater' },
                valueAsNumber: true
              })}
            />
            {errors.eventsConducted && (
              <p className="text-sm text-red-500">{errors.eventsConducted.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="fundsUtilized">Funds Utilized</Label>
            <Input
              id="fundsUtilized"
              type="number"
              min="0"
              step="0.01"
              className="w-full"
              {...register('fundsUtilized', { 
                required: 'This field is required',
                min: { value: 0, message: 'Value must be 0 or greater' },
                valueAsNumber: true
              })}
            />
            {errors.fundsUtilized && (
              <p className="text-sm text-red-500">{errors.fundsUtilized.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-between gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}