import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import connectDB from '@/lib/db';
import Report from '@/models/Report';
import EditForm from './EditForm';

export default async function ViewReportPage({ params }) {
  const { id } = await params;
  
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login');
  }
  
  await connectDB();
  
  const report = await Report.findById(id);
  
  if (!report) {
    notFound();
  }
  
  // Check if NGO is trying to view another NGO's report
  if (user.role === 'ngo' && report.ngoId !== user.ngoId) {
    redirect('/reports');
  }
  
  // Convert to plain object
  const serializedReport = {
    _id: report._id.toString(),
    ngoId: report.ngoId,
    month: report.month,
    peopleHelped: report.peopleHelped,
    eventsConducted: report.eventsConducted,
    fundsUtilized: report.fundsUtilized,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString()
  };
  
  return (
    <div className="w-full max-w-2xl mx-auto">
      <EditForm report={serializedReport} user={user} />
    </div>
  );
}