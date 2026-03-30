'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import useAuthStore from '@/store/authStore';
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
import { login } from '@/app/actions';
import { useSearchParams } from 'next/navigation';

function LoginForm() {
  const { setAuth } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('username', data.username);
      formData.append('password', data.password);

      const result = await login(formData);

      if (result.success) {
        setAuth(result.token, result.user);

        toast.success('Login successful', {
          description: 'You have been logged in successfully.',
        });

        const from = searchParams.get('from');
        const defaultDest = result.user.role === 'admin' ? '/admin' : '/dashboard';
        router.push(from || defaultDest);
      } else {
        toast.error('Login failed', {
          description: result.message,
        });
      }
    } catch (error) {
      toast.error('Login failed', {
        description: 'An unexpected error occurred.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <CardContent className="space-y-5 px-4 sm:px-6">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            placeholder="Enter your username"
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
            placeholder="Enter your password"
            className="w-full"
            {...register('password', { required: 'Password is required' })}
          />
          {errors.password && (
            <p className="text-sm text-red-500">{errors.password.message}</p>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-4 px-4 sm:px-6 pt-2 pb-6">
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Logging in...' : 'Login'}
        </Button>
        <p className="text-sm text-center text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-primary font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </CardFooter>
    </form>
  );
}

export default function Login() {
  return (
    <div className="flex items-center justify-center min-h-[80vh] p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-2 pt-6">
          <CardTitle className="text-xl sm:text-2xl">Kindera</CardTitle>
          <CardDescription>Log in to access the system</CardDescription>
        </CardHeader>
        <Suspense fallback={<div className="p-6 text-center">Loading form...</div>}>
          <LoginForm />
        </Suspense>
      </Card>
    </div>
  );
}