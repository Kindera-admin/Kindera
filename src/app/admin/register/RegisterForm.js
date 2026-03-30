'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { registerUser } from '@/app/actions';

export default function RegisterForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRole, setSelectedRole] = useState('ngo');
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm({
    defaultValues: {
      username: '',
      password: '',
      name: '',
      ngoId: '',
      organizationName: '',
    },
  });

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    
    try {
      const formData = new FormData();
      formData.append('username', data.username);
      formData.append('password', data.password);
      formData.append('role', selectedRole);
      formData.append('name', data.name);
      
      if (selectedRole === 'ngo') {
        formData.append('ngoId', data.ngoId);
      }
      
      if (selectedRole === 'org_spoc' || selectedRole === 'org_member') {
        formData.append('organizationName', data.organizationName);
      }
      
      const result = await registerUser(formData);
      
      if (result.success) {
        toast.success('User Registered', {
          description: 'The user has been registered successfully.'
        });
        router.push('/admin/users');
      } else {
        toast.error('Registration Failed', {
          description: result.message || 'An error occurred while registering the user.'
        });
      }
    } catch (error) {
      toast.error('Registration Failed', {
        description: 'An unexpected error occurred.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const showOrganizationField = selectedRole === 'org_spoc' || selectedRole === 'org_member';

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Register New User</CardTitle>
        <CardDescription>
          Create a new user account
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              className="w-full"
              {...register('username', { required: 'Username is required' })}
            />
            {errors.username && (
              <p className="text-sm text-red-500">{errors.username.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              className="w-full"
              {...register('password', { 
                required: 'Password is required',
                minLength: { value: 6, message: 'Password must be at least 6 characters' }
              })}
            />
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select 
              value={selectedRole} 
              onValueChange={(value) => {
                setSelectedRole(value);
                // Clear organization name when switching away from org roles
                if (value !== 'org_spoc' && value !== 'org_member') {
                  setValue('organizationName', '');
                }
                // Clear NGO ID when switching away from NGO role
                if (value !== 'ngo') {
                  setValue('ngoId', '');
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ngo">NGO</SelectItem>
                <SelectItem value="org_spoc">Organisation SPOC</SelectItem>
                <SelectItem value="org_member">Organisation Member</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              className="w-full"
              {...register('name', { required: 'Name is required' })}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>
          
          {selectedRole === 'ngo' && (
            <div className="space-y-2">
              <Label htmlFor="ngoId">NGO ID</Label>
              <Input
                id="ngoId"
                className="w-full"
                {...register('ngoId', { 
                  required: selectedRole === 'ngo' ? 'NGO ID is required for NGO users' : false
                })}
              />
              {errors.ngoId && (
                <p className="text-sm text-red-500">{errors.ngoId.message}</p>
              )}
            </div>
          )}
          
          {showOrganizationField && (
            <div className="space-y-2">
              <Label htmlFor="organizationName">Organisation Name</Label>
              <Input
                id="organizationName"
                className="w-full"
                placeholder="Enter organisation name"
                {...register('organizationName', { 
                  required: showOrganizationField ? 'Organisation name is required' : false
                })}
              />
              {errors.organizationName && (
                <p className="text-sm text-red-500">{errors.organizationName.message}</p>
              )}
            </div>
          )}
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
            {isSubmitting ? 'Registering...' : 'Register User'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}