'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { signup } from '@/app/actions';

function CertificateField({ label, hasName, regName, register, errors, watch }) {
  const hasValue = watch(hasName);
  return (
    <div className="space-y-2 rounded-lg border p-4">
      <p className="font-medium text-sm">{label}</p>
      <div className="flex gap-6">
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input type="radio" value="true" {...register(hasName)} className="accent-primary" />
          Yes
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input type="radio" value="false" {...register(hasName)} className="accent-primary" defaultChecked />
          No
        </label>
      </div>
      {hasValue === 'true' && (
        <div className="pt-1">
          <Input
            placeholder={`Enter ${label} registration number`}
            {...register(regName, { required: hasValue === 'true' ? `${label} number is required` : false })}
          />
          {errors[regName] && (
            <p className="text-sm text-red-500 mt-1">{errors[regName].message}</p>
          )}
        </div>
      )}
    </div>
  );
}

function SignupForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: '',
      username: '',
      organizationName: '',
      mobile: '',
      password: '',
      confirmPassword: '',
      has12A: 'false',
      reg12A: '',
      has80G: 'false',
      reg80G: '',
      hasFCRA: 'false',
      regFCRA: '',
    },
  });

  const password = watch('password');

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', data.name);
      formData.append('username', data.username);
      formData.append('organizationName', data.organizationName);
      formData.append('mobile', data.mobile);
      formData.append('password', data.password);
      formData.append('confirmPassword', data.confirmPassword);
      formData.append('has12A', data.has12A);
      formData.append('reg12A', data.reg12A || '');
      formData.append('has80G', data.has80G);
      formData.append('reg80G', data.reg80G || '');
      formData.append('hasFCRA', data.hasFCRA);
      formData.append('regFCRA', data.regFCRA || '');

      const result = await signup(formData);

      if (result.success) {
        toast.success('Account created', {
          description: 'Your account is pending admin approval.',
        });
        router.push('/pending');
      } else {
        toast.error('Signup failed', { description: result.message });
      }
    } catch {
      toast.error('Signup failed', { description: 'An unexpected error occurred.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <CardContent className="space-y-4 px-4 sm:px-6">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            placeholder="Enter your full name"
            {...register('name', {
              required: 'Name is required',
              minLength: { value: 2, message: 'Name must be at least 2 characters' },
            })}
          />
          {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
        </div>

        {/* Username */}
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            placeholder="Choose a username"
            {...register('username', {
              required: 'Username is required',
              minLength: { value: 3, message: 'Username must be at least 3 characters' },
              pattern: { value: /^[a-zA-Z0-9_]+$/, message: 'Only letters, numbers, and underscores allowed' },
            })}
          />
          {errors.username && <p className="text-sm text-red-500">{errors.username.message}</p>}
        </div>

        {/* Organization Name */}
        <div className="space-y-2">
          <Label htmlFor="organizationName">Organization Name</Label>
          <Input
            id="organizationName"
            placeholder="Enter your organization name"
            {...register('organizationName', {
              required: 'Organization name is required',
              minLength: { value: 2, message: 'Organization name must be at least 2 characters' },
            })}
          />
          {errors.organizationName && <p className="text-sm text-red-500">{errors.organizationName.message}</p>}
        </div>

        {/* Mobile */}
        <div className="space-y-2">
          <Label htmlFor="mobile">Mobile Number</Label>
          <Input
            id="mobile"
            type="tel"
            placeholder="Enter your mobile number"
            {...register('mobile', {
              required: 'Mobile number is required',
              pattern: { value: /^[6-9]\d{9}$/, message: 'Enter a valid 10-digit Indian mobile number' },
            })}
          />
          {errors.mobile && <p className="text-sm text-red-500">{errors.mobile.message}</p>}
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Create a password"
            {...register('password', {
              required: 'Password is required',
              minLength: { value: 6, message: 'Password must be at least 6 characters' },
            })}
          />
          {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Confirm your password"
            {...register('confirmPassword', {
              required: 'Please confirm your password',
              validate: (value) => value === password || 'Passwords do not match',
            })}
          />
          {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>}
        </div>

        {/* Certifications */}
        <div className="pt-2">
          <p className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
            Certifications
          </p>
          <div className="space-y-3">
            <CertificateField
              label="12A"
              hasName="has12A"
              regName="reg12A"
              register={register}
              errors={errors}
              watch={watch}
            />
            <CertificateField
              label="80G"
              hasName="has80G"
              regName="reg80G"
              register={register}
              errors={errors}
              watch={watch}
            />
            <CertificateField
              label="FCRA"
              hasName="hasFCRA"
              regName="regFCRA"
              register={register}
              errors={errors}
              watch={watch}
            />
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-4 px-4 sm:px-6 pt-2 pb-6">
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Creating account...' : 'Sign Up'}
        </Button>
        <p className="text-sm text-center text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Log in
          </Link>
        </p>
      </CardFooter>
    </form>
  );
}

export default function SignupPage() {
  return (
    <div className="flex items-center justify-center min-h-[80vh] p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-2 pt-6">
          <CardTitle className="text-xl sm:text-2xl">Create Account</CardTitle>
          <CardDescription>Sign up to join Kindera as an organization member</CardDescription>
        </CardHeader>
        <Suspense fallback={<div className="p-6 text-center">Loading form...</div>}>
          <SignupForm />
        </Suspense>
      </Card>
    </div>
  );
}
