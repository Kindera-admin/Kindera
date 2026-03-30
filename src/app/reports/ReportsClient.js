'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';

export default function ReportsClient({ reports, initialMonth, isAdmin }) {
  const router = useRouter();
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  
  const handleMonthChange = (e) => {
    const newMonth = e.target.value;
    setSelectedMonth(newMonth);
    router.push(`/reports${newMonth ? `?month=${newMonth}` : ''}`);
  };
  
  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Reports</h1>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-full sm:w-auto">
            <label htmlFor="month-filter" className="block sm:inline-block sm:mr-2 text-sm mb-1 sm:mb-0">Filter by Month:</label>
            <input
              id="month-filter"
              type="month"
              value={selectedMonth}
              onChange={handleMonthChange}
              className="border rounded px-2 py-1 w-full sm:w-auto"
            />
          </div>
          
          {/* Anyone can submit new reports */}
          <Button onClick={() => router.push('/reports/submit')} className="w-full sm:w-auto">
            Submit New Report
          </Button>
        </div>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 px-4">
            <p className="text-gray-500 mb-4">No reports found</p>
            <Button onClick={() => router.push('/reports/submit')}>
              Submit New Report
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:gap-6">
          {reports.map((report) => (
            <Card key={report._id}>
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row justify-between gap-2">
                  <div>
                    <CardTitle>Report for {report.month}</CardTitle>
                    <CardDescription>NGO ID: {report.ngoId}</CardDescription>
                  </div>
                  <div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => router.push(`/reports/edit/${report._id}`)}
                      className="w-full sm:w-auto"
                    >
                      View
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                  <div className="bg-blue-50 p-4 rounded-md">
                    <p className="text-sm text-gray-500">People Helped</p>
                    <p className="text-xl sm:text-2xl font-bold">{report.peopleHelped}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-md">
                    <p className="text-sm text-gray-500">Events Conducted</p>
                    <p className="text-xl sm:text-2xl font-bold">{report.eventsConducted}</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-md">
                    <p className="text-sm text-gray-500">Funds Utilized</p>
                    <p className="text-xl sm:text-2xl font-bold">{formatCurrency(report.fundsUtilized)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}