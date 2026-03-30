import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import connectDB from '@/lib/db';
import Report from '@/models/Report';
import User from '@/models/User';
import DashboardClient from '../dashboard/DashboardClient';

export default async function AdminPage({ searchParams }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  if (user.role !== 'admin') {
    redirect('/dashboard');
  }

  await connectDB();

  const params = await searchParams;
  const month = params?.month || '';

  let dashboardData;
  let reportsForMonth = [];

  if (month) {
    const reports = await Report.find({ month });

    const ngoIds = [...new Set(reports.map(report => report.ngoId))];
    const ngoUsers = await User.find({ role: 'ngo', ngoId: { $in: ngoIds } });

    const ngoNameMap = {};
    ngoUsers.forEach(ngoUser => {
      ngoNameMap[ngoUser.ngoId] = ngoUser.name;
    });

    reportsForMonth = reports.map(report => ({
      _id: report._id.toString(),
      ngoId: report.ngoId,
      ngoName: ngoNameMap[report.ngoId] || 'Unknown NGO',
      month: report.month || '',
      peopleHelped: report.peopleHelped || 0,
      eventsConducted: report.eventsConducted || 0,
      fundsUtilized: report.fundsUtilized || 0,
      createdAt: report.createdAt ? report.createdAt.toISOString() : '',
      updatedAt: report.updatedAt ? report.updatedAt.toISOString() : ''
    }));

    const result = await Report.aggregate([
      { $match: { month } },
      {
        $group: {
          _id: null,
          totalNGOs: { $addToSet: '$ngoId' },
          totalPeopleHelped: { $sum: '$peopleHelped' },
          totalEventsConducted: { $sum: '$eventsConducted' },
          totalFundsUtilized: { $sum: '$fundsUtilized' }
        }
      },
      {
        $project: {
          _id: 0,
          totalNGOs: { $size: '$totalNGOs' },
          totalPeopleHelped: 1,
          totalEventsConducted: 1,
          totalFundsUtilized: 1
        }
      }
    ]);

    dashboardData = result.length > 0 ? result[0] : {
      month,
      totalNGOs: 0,
      totalPeopleHelped: 0,
      totalEventsConducted: 0,
      totalFundsUtilized: 0
    };
  } else {
    const result = await Report.aggregate([
      {
        $group: {
          _id: null,
          totalNGOs: { $addToSet: '$ngoId' },
          totalPeopleHelped: { $sum: '$peopleHelped' },
          totalEventsConducted: { $sum: '$eventsConducted' },
          totalFundsUtilized: { $sum: '$fundsUtilized' }
        }
      },
      {
        $project: {
          _id: 0,
          totalNGOs: { $size: '$totalNGOs' },
          totalPeopleHelped: 1,
          totalEventsConducted: 1,
          totalFundsUtilized: 1
        }
      }
    ]);

    dashboardData = result.length > 0 ? result[0] : {
      totalNGOs: 0,
      totalPeopleHelped: 0,
      totalEventsConducted: 0,
      totalFundsUtilized: 0
    };
  }

  const availableMonths = await Report.distinct('month');
  availableMonths.sort().reverse();

  return (
    <DashboardClient
      initialData={dashboardData}
      initialMonth={month}
      reportsForMonth={reportsForMonth}
      availableMonths={availableMonths}
    />
  );
}
