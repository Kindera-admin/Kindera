'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/utils';

export default function EditForm({ report, user }) {
  const router = useRouter();
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>View Report</CardTitle>
        <CardDescription>
          Report details for {report.month}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="ngoId">NGO ID</Label>
          <Input
            id="ngoId"
            value={report.ngoId}
            disabled={true}
            readOnly
            className="w-full"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="month">Month</Label>
          <Input
            id="month"
            type="month"
            value={report.month}
            disabled={true}
            readOnly
            className="w-full"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="peopleHelped">People Helped</Label>
          <Input
            id="peopleHelped"
            type="number"
            value={report.peopleHelped}
            disabled={true}
            readOnly
            className="w-full"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="eventsConducted">Events Conducted</Label>
          <Input
            id="eventsConducted"
            type="number"
            value={report.eventsConducted}
            disabled={true}
            readOnly
            className="w-full"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="fundsUtilized">Funds Utilized</Label>
          <Input
            id="fundsUtilized"
            type="text"
            value={formatCurrency(report.fundsUtilized)}
            disabled={true}
            readOnly
            className="w-full"
          />
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-center">
        <Button type="button" variant="outline" onClick={() => router.back()} className="w-full sm:w-auto">
          Back to Reports
        </Button>
      </CardFooter>
    </Card>
  );
}