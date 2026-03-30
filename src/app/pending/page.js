import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function PendingPage() {
  return (
    <div className="flex items-center justify-center min-h-[80vh] p-4">
      <Card className="w-full max-w-md shadow-lg text-center">
        <CardHeader className="pt-8 pb-2">
          <div className="text-5xl mb-4">⏳</div>
          <CardTitle className="text-xl sm:text-2xl">Approval Pending</CardTitle>
          <CardDescription className="text-base mt-1">
            Your account has been created successfully
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-8 space-y-4">
          <p className="text-muted-foreground">
            Your account is currently awaiting approval from an administrator.
            You will be able to log in once your account has been approved.
          </p>
          <p className="text-sm text-muted-foreground">
            Please contact your administrator if you need immediate access.
          </p>
          <Button asChild className="w-full mt-2">
            <Link href="/login">Back to Login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
