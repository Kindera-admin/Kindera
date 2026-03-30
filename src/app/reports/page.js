import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import connectDB from '@/lib/db';
import Report from '@/models/Report';
import ReportsClient from './ReportsClient';

export default async function ReportsPage({ searchParams }) {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login');
  }
  
  const { month = '' } =  await searchParams;
  
  await connectDB();
  
  const filter = {};
  if (month) filter.month = month;
  
  if (user.role === 'ngo') {
    filter.ngoId = user.ngoId;
  }
  
  const reports = await Report.find(filter).sort({ month: -1 });
  
  // Convert to plain objects
  const serializedReports = reports.map(report => ({
    _id: report._id.toString(),
    ngoId: report.ngoId,
    month: report.month,
    peopleHelped: report.peopleHelped,
    eventsConducted: report.eventsConducted,
    fundsUtilized: report.fundsUtilized,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString()
  }));
  
  return <ReportsClient 
    reports={serializedReports} 
    initialMonth={month} 
    isAdmin={user.role === 'admin'} 
  />;
}