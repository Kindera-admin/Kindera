import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getEventAttendance } from '@/app/actions';
import AttendanceClient from './AttendanceClient';
import Event from '@/models/Event';
import connectDB from '@/lib/db';

export default async function AttendancePage({ params }) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  
  if (!user) redirect('/login');
  if (user.role !== 'admin' && user.role !== 'org_spoc') redirect('/dashboard');

  await connectDB();
  const event = await Event.findById(eventId).lean();
  if (!event) redirect('/dashboard');

  // Filter attendance by this SPOC's org (Admin gets all)
  const filterOrg = user.role === 'org_spoc' ? user.organizationName : null;
  const { records = [] } = await getEventAttendance(eventId, filterOrg);

  return (
    <div className="w-full max-w-5xl mx-auto">
      <AttendanceClient 
        event={JSON.parse(JSON.stringify(event))} 
        initialRecords={records} 
        orgName={user.organizationName || 'All Organizations'} 
      />
    </div>
  );
}
