'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';

export default function DashboardClient({ initialData, initialMonth, reportsForMonth = [], availableMonths = [] }) {
  const router = useRouter();
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [dashboardData, setDashboardData] = useState(initialData);
  
  // Add this useEffect to update the dashboard data when initialData changes
  useEffect(() => {
    setDashboardData(initialData);
  }, [initialData]);
  
  const handleMonthChange = (e) => {
    const newMonth = e.target.value;
    setSelectedMonth(newMonth);
    router.push(`/dashboard${newMonth ? `?month=${newMonth}` : ''}`);
  };
  
  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-full sm:w-auto">
            <label htmlFor="month-filter" className="block sm:inline-block sm:mr-2 text-sm mb-1 sm:mb-0">Select Month:</label>
            <input
              id="month-filter"
              type="month"
              value={selectedMonth}
              onChange={handleMonthChange}
              className="border rounded px-2 py-1 w-full sm:w-auto"
            />
          </div>
          
          <Button onClick={() => router.push('/reports')} className="w-full sm:w-auto">
            View All Reports
          </Button>
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-4">
        Summary for {selectedMonth || 'All Time'}
      </h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">NGOs Reporting</CardTitle>
            <CardDescription>Total organizations</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl md:text-4xl font-bold">{dashboardData.totalNGOs || 0}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">People Helped</CardTitle>
            <CardDescription>Total beneficiaries</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl md:text-4xl font-bold">{dashboardData.totalPeopleHelped || 0}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Events Conducted</CardTitle>
            <CardDescription>Total activities</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl md:text-4xl font-bold">{dashboardData.totalEventsConducted || 0}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Funds Utilized</CardTitle>
            <CardDescription>Total expenditure</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl md:text-4xl font-bold">
              {formatCurrency(dashboardData.totalFundsUtilized || 0)}
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Display reports list when a month is selected */}
      {selectedMonth && reportsForMonth.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">
            Individual Reports for {selectedMonth}
          </h2>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">NGO Name</TableHead>
                    <TableHead className="text-right whitespace-nowrap">People Helped</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Events</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Funds</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportsForMonth.map((report) => (
                    <TableRow key={report._id}>
                      <TableCell className="font-medium whitespace-nowrap">{report.ngoName}</TableCell>
                      <TableCell className="text-right">{report.peopleHelped}</TableCell>
                      <TableCell className="text-right">{report.eventsConducted}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatCurrency(report.fundsUtilized)}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => router.push(`/reports/edit/${report._id}`)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
      
      {selectedMonth && reportsForMonth.length === 0 && (
        <Card>
          <CardContent className="py-6 md:py-8">
            <div className="text-center">
              <h3 className="text-lg font-medium mb-2">No data available for {selectedMonth}</h3>
              <p className="text-gray-500 mb-4">
                There are no reports submitted for the selected month.
              </p>
              <Button onClick={() => router.push('/reports/submit')}>
                Submit a Report
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}