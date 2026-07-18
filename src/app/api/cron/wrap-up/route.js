import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Event from '@/models/Event';
import Attendance from '@/models/Attendance';
import User from '@/models/User';
import Announcement from '@/models/Announcement';

export async function GET(request) {
  try {
    // Note: In a real app, you would verify an Authorization header (e.g. from Vercel Cron)
    // For now, this endpoint can be triggered manually or via basic cron ping.

    await connectDB();
    const now = new Date();
    
    // Find events that ended at least 24 hours ago, and where wrapUpSent is false
    // Since we don't have an exact endDate in schema, we assume `date` is the event start,
    // and we'll check if 24 hours have passed since the event date.
    // If the event is 'completed', it's safe to run.
    const cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const eventsToWrapUp = await Event.find({
      wrapUpSent: false,
      date: { $lte: cutoffDate } // event was at least 24h ago
    }).populate('createdBy', 'name role organizationName');

    const results = [];

    for (const event of eventsToWrapUp) {
      // Find all attended participants
      const attendances = await Attendance.find({
        eventId: event._id,
        attended: true
      });

      if (attendances.length === 0) {
        // No attendance recorded, skip or mark sent anyway
        event.wrapUpSent = true;
        await event.save();
        results.push({ eventId: event._id, sent: 0, reason: 'No attendees' });
        continue;
      }

      // Group by organization
      const orgStats = {};
      for (const att of attendances) {
        // Fallback to event organizationName if internal
        const orgName = att.organizationName || event.organizationName;
        if (!orgName) continue; // skip public volunteers

        if (!orgStats[orgName]) {
          orgStats[orgName] = { members: 0, hours: 0 };
        }
        orgStats[orgName].members += 1;
        orgStats[orgName].hours += (att.hoursContributed || 0);
      }

      let sentCount = 0;

      // For each organization, find their SPOC and send announcement
      for (const [orgName, stats] of Object.entries(orgStats)) {
        const spocs = await User.find({ role: 'org_spoc', organizationName: orgName });
        
        for (const spoc of spocs) {
          const content = `The event "${event.title}" has successfully concluded. Your organization had ${stats.members} member(s) participate, logging a total of ${stats.hours} hours. Thank you for your impact!`;
          
          await Announcement.create({
            recipient: spoc._id,
            title: `Event Wrap-Up: ${event.title}`,
            content: content,
            type: 'event_wrap_up'
          });
          sentCount++;
        }
      }

      event.wrapUpSent = true;
      await event.save();
      results.push({ eventId: event._id, sent: sentCount });
    }

    return NextResponse.json({ success: true, processed: results });
  } catch (error) {
    console.error('Error in wrap-up cron:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
