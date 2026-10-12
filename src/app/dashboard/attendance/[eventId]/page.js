import { redirect } from 'next/navigation';
import { isValidObjectId } from 'mongoose';
import { getCurrentUser } from '@/lib/auth';
import { getEventAttendance } from '@/app/actions';
import AttendanceClient from './AttendanceClient';
import { getCompanyName, canSeeEvent } from '@/lib/company';
import Event from '@/models/Event';
import connectDB from '@/lib/db';

export default async function AttendancePage({ params }) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  
  if (!user) redirect('/login');
  if (user.role !== 'admin' && user.role !== 'org_spoc') redirect('/dashboard');
  if (!isValidObjectId(eventId)) redirect('/dashboard');

  await connectDB();
  const event = await Event.findById(eventId).lean();
  if (!event || !canSeeEvent(user, event)) redirect('/dashboard');

  // SPOCs see their own company's attendance; admins see everyone's.
  const companyId = user.role === 'org_spoc' && user.companyId ? String(user.companyId) : null;
  const companyName = companyId ? await getCompanyName(companyId) : null;
  const { records = [] } = await getEventAttendance(eventId, companyId);

  return (
    <div className="w-full max-w-5xl mx-auto">
      <AttendanceClient
        event={JSON.parse(JSON.stringify(event))}
        initialRecords={records}
        companyId={companyId}
        companyName={companyName}
      />
    </div>
  );
}
