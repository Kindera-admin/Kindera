'use server'

import connectDB from '@/lib/db';
import Report from '@/models/Report';
import User from '@/models/User';
import Event from '@/models/Event';
import NGOPartner from '@/models/NGOPartner';
import Attendance from '@/models/Attendance';
import ImpactPhoto from '@/models/ImpactPhoto';
import Message from '@/models/Message';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

async function signToken(user) {
  const secretKey = new TextEncoder().encode(process.env.JWT_SECRET);
  const payload = {
    userId: user._id.toString(),
    role: user.role
  };
  
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secretKey);
}

async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  
  if (!token) return null;
  
  // Import the verification function directly to avoid circular dependencies
  try {
    const secretKey = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export async function login(formData) {
  try {
    const username = formData.get('username');
    const password = formData.get('password');
    
    await connectDB();
    
    const user = await User.findOne({ username });
    
    if (user && (await user.comparePassword(password))) {
      const effectiveStatus = user.status ?? 'pending';
      if (user.role !== 'admin' && effectiveStatus !== 'approved') {
        return { success: false, message: 'Your account is pending approval. Please contact an administrator.' };
      }

      const token = await signToken(user);
      
      // Set the auth cookie
      const cookieStore = await cookies();
      cookieStore.set({
        name: 'auth-token',
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/'
      });
      
      return { 
        success: true, 
        user: {
          _id: user._id.toString(),
          username: user.username,
          role: user.role,
          ngoId: user.ngoId,
          organizationName: user.organizationName,
          name: user.name
        },
        token
      };
    } else {
      return {
        success: false, 
        message: 'Invalid username or password'
      };
    }
  } catch (error) {
    console.error(error);
    return { 
      success: false, 
      message: 'Server error', 
      error: error.message 
    };
  }
}

export async function logout() {
    const cookieStore = await cookies();
    cookieStore.set({
      name: 'auth-token',
      value: '',
      httpOnly: true,
      expires: new Date(0),
      path: '/'
    });
    
    return { success: true };
  }

export async function registerUser(formData) {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Not authenticated' };
  }
  
  try {
    await connectDB();
    
    const user = await getCurrentUser();
    
    if (user.role !== 'admin' && user.role !== 'employee') {
      return { success: false, message: 'Unauthorized' };
    }
    
    const username = formData.get('username');
    const password = formData.get('password');
    const role = formData.get('role');
    const ngoId = formData.get('ngoId');
    const name = formData.get('name');
    const organizationName = formData.get('organizationName');

    if (user.role === 'employee' && role !== 'ngo') {
      return { success: false, message: 'Employees are only allowed to register NGO users' };
    }
    
    if (!username || !password || !role || !name) {
      return { success: false, message: 'All fields are required' };
    }

    if (role === 'admin') {
      return { success: false, message: 'Cannot create additional admin accounts' };
    }

    if (role === 'ngo' && !ngoId) {
      return { success: false, message: 'NGO ID is required for NGO users' };
    }
    
    if ((role === 'org_spoc' || role === 'org_member') && !organizationName) {
      return { success: false, message: 'Organisation name is required for Organisation SPOC and Organisation Member' };
    }
    
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return { success: false, message: 'User already exists' };
    }
    
    const userData = {
      username,
      password,
      role,
      name,
      status: 'approved'
    };
    
    if (role === 'ngo') {
      userData.ngoId = ngoId;
    }
    
    if (role === 'org_spoc' || role === 'org_member') {
      userData.organizationName = organizationName;
    }
    
    const newUser = await User.create(userData);
    
    revalidatePath('/admin/users');
    return { success: true, userId: newUser._id.toString() };
  } catch (error) {
    console.error(error);
    return { success: false, message: error.message };
  }
}

// Report actions
export async function createAdminUser() {
  try {
    await connectDB();

    const adminExists = await User.findOne({ role: 'admin' });

    if (adminExists) {
      return { success: false, message: 'Admin user already exists' };
    }

    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;
    const name = process.env.ADMIN_NAME || 'Administrator';

    if (!username || !password) {
      return { success: false, message: 'ADMIN_USERNAME and ADMIN_PASSWORD must be set in environment variables' };
    }

    await User.create({
      username,
      password,
      role: 'admin',
      name,
      status: 'approved'
    });

    return { success: true, message: `Admin user '${username}' created successfully` };
  } catch (error) {
    console.error('Error creating admin user:', error);
    return { success: false, message: error.message };
  }
}

export async function getReports(month = '', ngoId = '') {
  try {
    // Check authentication
    const session = await getSession();
    if (!session) {
      return { success: false, message: 'Not authenticated' };
    }
    
    await connectDB();
    
    const filter = {};
    if (month) filter.month = month;
    if (ngoId) filter.ngoId = ngoId;
    
    // For NGO users, restrict to their own reports
    const currentUser = await getCurrentUser();
    if (currentUser.role === 'ngo') {
      filter.ngoId = currentUser.ngoId;
    }
    
    const reports = await Report.find(filter).sort({ month: -1 });
    
    return {
      success: true,
      count: reports.length,
      reports: reports.map(report => ({
        _id: report._id.toString(),
        ngoId: report.ngoId,
        month: report.month,
        peopleHelped: report.peopleHelped,
        eventsConducted: report.eventsConducted,
        fundsUtilized: report.fundsUtilized,
        createdAt: report.createdAt.toISOString(),
        updatedAt: report.updatedAt.toISOString()
      }))
    };
  } catch (error) {
    console.error(error);
    return { success: false, message: error.message };
  }
}

export async function getReportById(id) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session) {
      return { success: false, message: 'Not authenticated' };
    }
    
    await connectDB();
    
    const report = await Report.findById(id);
    
    if (!report) {
      return { success: false, message: 'Report not found' };
    }
    
    // Check permissions
    const currentUser = await getCurrentUser();
    if (currentUser.role === 'ngo' && report.ngoId !== currentUser.ngoId) {
      return { success: false, message: 'Not authorized to access this report' };
    }
    
    return {
      success: true,
      report: {
        _id: report._id.toString(),
        ngoId: report.ngoId,
        month: report.month,
        peopleHelped: report.peopleHelped,
        eventsConducted: report.eventsConducted,
        fundsUtilized: report.fundsUtilized,
        createdAt: report.createdAt.toISOString(),
        updatedAt: report.updatedAt.toISOString()
      }
    };
  } catch (error) {
    console.error(error);
    return { success: false, message: error.message };
  }
}

export async function submitReport(formData) {
  const session = await getSession();
  console.log('Session in submitReport:', session); // Debugging log
  if (!session) {
    console.log('No session found in submitReport'); // Debugging log
    return { success: false, message: 'Not authenticated' };
  }
  
  try {
    await connectDB();
    
    const user = await getCurrentUser();
    console.log('User in submitReport:', user); // Debugging log
    
    const ngoId = formData.get('ngoId');
    const month = formData.get('month');
    const peopleHelped = parseInt(formData.get('peopleHelped'));
    const eventsConducted = parseInt(formData.get('eventsConducted'));
    const fundsUtilized = parseFloat(formData.get('fundsUtilized'));
    console.log('Form data in submitReport:', { ngoId, month, peopleHelped, eventsConducted, fundsUtilized }); // Debugging log
    
    if (user.role === 'ngo' && user.ngoId !== ngoId) {
      console.log('Permission denied in submitReport:', { userRole: user.role, userNgoId: user.ngoId, formNgoId: ngoId }); // Debugging log
      return { success: false, message: 'You can only submit reports for your own NGO' };
    }
    
    const existingReport = await Report.findOne({ ngoId, month });
    console.log('Existing report in submitReport:', existingReport); // Debugging log
    if (existingReport) {
      return { success: false, message: 'A report for this month already exists' };
    }
    
    const report = await Report.create({
      ngoId,
      month,
      peopleHelped,
      eventsConducted,
      fundsUtilized
    });
    console.log('Report created in submitReport:', report); // Debugging log
    
    revalidatePath('/reports');
    return { 
      success: true,
      report: {
        _id: report._id.toString(),
        ngoId: report.ngoId,
        month: report.month,
        peopleHelped: report.peopleHelped,
        eventsConducted: report.eventsConducted,
        fundsUtilized: report.fundsUtilized
      }
    };
  } catch (error) {
    console.error('Error in submitReport:', error); // Debugging log
    return { success: false, message: error.message };
  }
}

export async function updateReport(id, formData) {
  // Disabled - No editing allowed
  return { success: false, message: 'Editing reports is disabled' };
}

export async function deleteReport(id) {
  // Disabled - No deletion allowed
  return { success: false, message: 'Deleting reports is disabled' };
}

export async function getDashboardData(month = '') {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, message: 'Not authenticated' };
    }
    
    await connectDB();
    
    const currentUser = await getCurrentUser();
    if (currentUser.role !== 'admin') {
      return { success: false, message: 'Not authorized as admin' };
    }
    
    // Validate month format if provided
    if (month) {
      const monthRegex = /^\d{4}-\d{2}$/;
      if (!monthRegex.test(month)) {
        return {
          success: false,
          message: 'Month must be in YYYY-MM format'
        };
      }
    }
    
    const filter = month ? { month } : {};
    
    const aggregationResult = await Report.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$month',
          totalNGOs: { $addToSet: '$ngoId' },
          totalPeopleHelped: { $sum: '$peopleHelped' },
          totalEventsConducted: { $sum: '$eventsConducted' },
          totalFundsUtilized: { $sum: '$fundsUtilized' }
        }
      },
      {
        $project: {
          _id: 0,
          month: '$_id',
          totalNGOs: { $size: '$totalNGOs' },
          totalPeopleHelped: 1,
          totalEventsConducted: 1,
          totalFundsUtilized: 1
        }
      },
      { $sort: { month: -1 } }
    ]);
    
    // If no data found for the month
    if (month && aggregationResult.length === 0) {
      return {
        success: true,
        data: {
          month,
          totalNGOs: 0,
          totalPeopleHelped: 0,
          totalEventsConducted: 0,
          totalFundsUtilized: 0
        }
      };
    }
    
    return {
      success: true,
      data: month ? aggregationResult[0] : aggregationResult
    };
  } catch (error) {
    console.error(error);
    return { success: false, message: error.message };
  }
}

// User management actions
export async function getAllUsers() {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, message: 'Not authenticated' };
    }
    
    await connectDB();
    
    const currentUser = await getCurrentUser();
    if (currentUser.role !== 'admin') {
      return { success: false, message: 'Only admin can access user management' };
    }
    
    // Get all users except the current admin (self)
    const users = await User.find({ _id: { $ne: currentUser._id } })
      .populate({
        path: 'eventRegistrations.eventId',
        select: 'title createdBy',
        populate: { path: 'createdBy', select: 'organizationName name' }
      })
      .select('-password').lean();
    
    return {
      success: true,
      users: users.map(user => ({
        _id: user._id.toString(),
        username: user.username,
        role: user.role,
        ngoId: user.ngoId,
        organizationName: user.organizationName,
        name: user.name,
        status: user.status || 'pending',
        mobile: user.mobile || '',
        email: user.email || '',
        age: user.age || null,
        has12A: user.has12A || false,
        reg12A: user.reg12A || '',
        has80G: user.has80G || false,
        reg80G: user.reg80G || '',
        hasFCRA: user.hasFCRA || false,
        regFCRA: user.regFCRA || '',
        createdAt: user.createdAt ? user.createdAt.toISOString() : null,
        eventRegistrations: (user.eventRegistrations || []).map(reg => ({
          eventId: reg.eventId?._id?.toString(),
          title: reg.eventId?.title,
          organizerName: reg.eventId?.createdBy?.organizationName || reg.eventId?.createdBy?.name || 'Unknown',
          status: reg.status,
          comment: reg.comment,
          appliedAt: reg.appliedAt ? reg.appliedAt.toISOString() : null
        }))
      }))
    };
  } catch (error) {
    console.error('Error fetching users:', error);
    return { success: false, message: error.message };
  }
}

export async function getMyRegisteredEventIds() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: true, approvedEventIds: [], pendingEventIds: [] };
    await connectDB();
    const user = await User.findById(currentUser._id).select('eventRegistrations').lean();
    const approvedEventIds = (user?.eventRegistrations || [])
      .filter(r => r.status === 'approved')
      .map(r => r.eventId.toString());
    const pendingEventIds = (user?.eventRegistrations || [])
      .filter(r => r.status === 'pending')
      .map(r => r.eventId.toString());
    return { success: true, approvedEventIds, pendingEventIds };
  } catch (error) {
    return { success: true, approvedEventIds: [], pendingEventIds: [] };
  }
}

export async function getPendingEventRegistrations() {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    await connectDB();
    const currentUser = await getCurrentUser();

    // Find all events created by the current user, or all events if admin
    let eventQuery = { createdBy: currentUser._id };
    if (currentUser.role === 'admin') {
      eventQuery = {};
    }
    const userEvents = await Event.find(eventQuery).select('_id title').lean();
    const eventIds = userEvents.map(e => e._id);

    // Find all users who have at least one pending registration for these events
    const users = await User.find({
      'eventRegistrations.status': 'pending',
      'eventRegistrations.eventId': { $in: eventIds }
    }).populate('eventRegistrations.eventId', 'title').lean();

    // Flatten and format the response: one entry per pending registration
    const pendingRegistrations = [];
    users.forEach(user => {
      user.eventRegistrations.forEach(reg => {
        if (reg.status === 'pending' && eventIds.some(id => id.toString() === reg.eventId._id.toString())) {
          pendingRegistrations.push({
            _id: user._id.toString(),
            name: user.name,
            username: user.username,
            role: user.role,
            organizationName: user.organizationName || '',
            mobile: user.mobile || '',
            email: user.email || '',
            age: user.age || null,
            photoUrl: user.photoUrl || '',
            registrationReason: reg.comment || '',
            volunteersCount: reg.volunteersCount || 1,
            volunteerNames: reg.volunteerNames || '',
            registeredForEvent: {
              _id: reg.eventId._id.toString(),
              title: reg.eventId.title
            }
          });
        }
      });
    });

    return {
      success: true,
      users: pendingRegistrations
    };
  } catch (error) {
    console.error('Error fetching pending registrations:', error);
    return { success: false, message: error.message };
  }
}

export async function updateUserStatus(formData) {
  const session = await getSession();
  if (!session) return { success: false, message: 'Not authenticated' };

  try {
    await connectDB();
    const currentUser = await getCurrentUser();
    const userId = formData.get('userId');
    const status = formData.get('status');

    if (!['approved', 'rejected'].includes(status)) {
      return { success: false, message: 'Invalid status' };
    }

    if (currentUser.role !== 'admin') {
      return { success: false, message: 'Only admin can manage global user status' };
    }

    const result = await User.updateOne(
      { _id: userId },
      { $set: { status } }
    );

    if (result.matchedCount === 0) {
      return { success: false, message: 'User not found' };
    }

    revalidatePath('/admin/users');
    return { success: true, modifiedCount: result.modifiedCount };
  } catch (error) {
    console.error('Error updating user status:', error);
    return { success: false, message: error.message };
  }
}

export async function deleteUser(formData) {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, message: 'Not authenticated' };
    }
    
    await connectDB();
    
    const currentUser = await getCurrentUser();
    if (currentUser.role !== 'admin') {
      return { success: false, message: 'Only admin can delete users' };
    }
    
    const userId = formData.get('userId');
    if (!userId) {
      return { success: false, message: 'User ID is required' };
    }
    
    // Prevent deleting the current admin user
    if (userId === currentUser._id.toString()) {
      return { success: false, message: 'You cannot delete your own account' };
    }
    
    // Get the user to be deleted to check role and ngoId
    const userToDelete = await User.findById(userId);
    if (!userToDelete) {
      return { success: false, message: 'User not found' };
    }
    
    // Delete all reports associated with the user if they are an NGO
    if (userToDelete.role === 'ngo' && userToDelete.ngoId) {
      await Report.deleteMany({ ngoId: userToDelete.ngoId });
    }
    
    // Delete the user
    await User.findByIdAndDelete(userId);
    
    revalidatePath('/admin/users');
    return { success: true, message: 'User and associated data deleted successfully' };
  } catch (error) {
    console.error('Error deleting user:', error);
    return { success: false, message: error.message };
  }
}

// Event management actions
export async function createEvent(formData) {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, message: 'Not authenticated' };
    }
    
    await connectDB();
    
    const user = await getCurrentUser();
    
    // Only admin, NGO, and org_spoc can create events
    if (!['admin', 'ngo', 'org_spoc'].includes(user.role)) {
      return { success: false, message: 'You do not have permission to create events' };
    }
    
    const title = formData.get('title');
    const description = formData.get('description');
    const date = formData.get('date');
    const location = formData.get('location');
    const capacity = formData.get('capacity');
    const imageUrl = formData.get('imageUrl');
    const beneficiariesImpacted = formData.get('beneficiariesImpacted');
    const durationHours = formData.get('durationHours') ? parseFloat(formData.get('durationHours')) : 2;

    if (!title || !description || !date || !location) {
      return { success: false, message: 'All required fields must be filled' };
    }
    
    const event = await Event.create({
      title,
      description,
      date: new Date(date),
      location,
      registrationLink: '',
      capacity: capacity ? parseInt(capacity) : null,
      durationHours,
      beneficiariesImpacted: beneficiariesImpacted ? parseInt(beneficiariesImpacted) : 0,
      imageUrl: imageUrl || '',
      createdBy: user._id,
      createdByRole: user.role,
      organizationName: user.role === 'org_spoc' ? user.organizationName : null,
      status: 'upcoming'
    });
    
    revalidatePath('/');
    revalidatePath('/events');
    
    return { 
      success: true,
      event: {
        _id: event._id.toString(),
        title: event.title,
        description: event.description,
        date: event.date.toISOString(),
        location: event.location,
        registrationLink: event.registrationLink,
        capacity: event.capacity,
        durationHours: event.durationHours,
        imageUrl: event.imageUrl,
        status: event.status
      }
    };
  } catch (error) {
    console.error('Error creating event:', error);
    return { success: false, message: error.message };
  }
}

export async function getHomeEvents() {
  try {
    await connectDB();
    const currentUser = await getCurrentUser();

    const filter = { status: 'upcoming' };
    
    if (!currentUser || currentUser.role === 'volunteer') {
      filter.$or = [
        { createdByRole: 'ngo' },
        { createdByRole: 'admin' },
        { organizationName: null },
        { organizationName: { $exists: false } }
      ];
    } else if (currentUser.role === 'org_spoc') {
      // SPOC sees NGO/admin events + only their own org events
      filter.$or = [
        { createdByRole: 'ngo' },
        { createdByRole: 'admin' },
        { organizationName: null },
        { organizationName: { $exists: false } },
        { createdBy: currentUser._id }
      ];
    } else if (currentUser.role === 'org_member') {
      // Org member sees NGO/admin events + only events created by their SPOC
      filter.$or = [
        { createdByRole: 'ngo' },
        { createdByRole: 'admin' },
        { organizationName: null },
        { organizationName: { $exists: false } },
        ...(currentUser.spocId ? [{ createdBy: currentUser.spocId }] : [])
      ];
    }

    const events = await Event.find(filter)
      .sort({ date: 1 })
      .limit(6);

    const now = new Date();
    
    // Map and calculate lifecycle
    const processedEvents = events.map(event => {
      const start = new Date(event.date);
      const end = new Date(start.getTime() + (event.durationHours || 2) * 60 * 60 * 1000);
      let lifecycle = 'upcoming';
      if (now > end) lifecycle = 'ended';
      else if (now >= start && now <= end) lifecycle = 'live';

      return {
        _id: event._id.toString(),
        title: event.title,
        description: event.description,
        date: event.date.toISOString(),
        location: event.location,
        registrationLink: event.registrationLink,
        durationHours: event.durationHours || 2,
        imageUrl: event.imageUrl,
        status: event.status,
        lifecycle,
      };
    }).filter(e => e.lifecycle !== 'ended');

    return {
      success: true,
      events: processedEvents.slice(0, 6)
    };
  } catch (error) {
    console.error('Error fetching home events:', error);
    return { success: false, events: [] };
  }
}

export async function getEvents(optionsOrStatus = {}) {
  try {
    await connectDB();

    let status = '';
    let includeEnded = false;

    if (typeof optionsOrStatus === 'string') {
      status = optionsOrStatus;
    } else {
      status = optionsOrStatus.status || '';
      includeEnded = optionsOrStatus.includeEnded || false;
    }

    const filter = {};
    if (status) filter.status = status;
    
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role === 'volunteer') {
      filter.$or = [
        { createdByRole: 'ngo' },
        { createdByRole: 'admin' },
        { organizationName: null },
        { organizationName: { $exists: false } }
      ];
    } else if (currentUser.role === 'org_spoc') {
      // SPOC sees NGO/admin events + only their own org events
      filter.$or = [
        { createdByRole: 'ngo' },
        { createdByRole: 'admin' },
        { organizationName: null },
        { organizationName: { $exists: false } },
        { createdBy: currentUser._id }
      ];
    } else if (currentUser.role === 'org_member') {
      // Org member sees NGO/admin events + only events created by their SPOC
      filter.$or = [
        { createdByRole: 'ngo' },
        { createdByRole: 'admin' },
        { organizationName: null },
        { organizationName: { $exists: false } },
        ...(currentUser.spocId ? [{ createdBy: currentUser.spocId }] : [])
      ];
    }

    const events = await Event.find(filter)
      .populate('createdBy', 'name role')
      .sort({ date: 1 })
      .lean();
    
    const now = new Date();
    
    let processedEvents = events.map(event => {
      const start = new Date(event.date);
      const end = new Date(start.getTime() + (event.durationHours || 2) * 60 * 60 * 1000);
      let lifecycle = 'upcoming';
      if (now > end) lifecycle = 'ended';
      else if (now >= start && now <= end) lifecycle = 'live';

      return {
        _id: event._id.toString(),
        title: event.title,
        description: event.description,
        date: event.date.toISOString(),
        location: event.location,
        registrationLink: event.registrationLink,
        capacity: event.capacity,
        durationHours: event.durationHours || 2,
        imageUrl: event.imageUrl,
        status: event.status,
        lifecycle,
        createdBy: event.createdBy ? {
          _id: event.createdBy._id.toString(),
          name: event.createdBy.name,
          role: event.createdBy.role
        } : null,
        createdAt: event.createdAt.toISOString()
      };
    });

    if (!includeEnded) {
      processedEvents = processedEvents.filter(e => e.lifecycle !== 'ended');
    }

    return {
      success: true,
      events: processedEvents
    };
  } catch (error) {
    console.error('Error fetching events:', error);
    return { success: false, message: error.message };
  }
}

export async function getEventById(id) {
  try {
    await connectDB();
    
    const event = await Event.findById(id).populate('createdBy', 'name role').lean();
    
    if (!event) {
      return { success: false, message: 'Event not found' };
    }

    const currentUser = await getCurrentUser();
    
    if (event.organizationName) {
      // It's a private SPOC event
      if (!currentUser) {
        return { success: false, message: 'You must be logged in to view this private event' };
      }
      if (currentUser.role === 'admin' || currentUser.role === 'employee') {
        // admins and employees can always see everything — allowed
      } else if (currentUser.role === 'org_spoc') {
        // SPOC can only see events they created themselves
        if (event.createdBy._id.toString() !== currentUser._id.toString()) {
          return { success: false, message: 'You do not have permission to view this event' };
        }
      } else if (currentUser.role === 'org_member') {
        // Org member can only see events created by their SPOC
        if (!currentUser.spocId || event.createdBy._id.toString() !== currentUser.spocId.toString()) {
          return { success: false, message: 'You do not have permission to view this event' };
        }
      } else {
        return { success: false, message: 'You do not have permission to view this event' };
      }
    }
    
    const now = new Date();
    const start = new Date(event.date);
    const end = new Date(start.getTime() + (event.durationHours || 2) * 60 * 60 * 1000);
    let lifecycle = 'upcoming';
    if (now > end) lifecycle = 'ended';
    else if (now >= start && now <= end) lifecycle = 'live';

    return {
      success: true,
      event: {
        _id: event._id.toString(),
        title: event.title,
        description: event.description,
        date: event.date.toISOString(),
        location: event.location,
        registrationLink: event.registrationLink,
        capacity: event.capacity,
        durationHours: event.durationHours || 2,
        imageUrl: event.imageUrl,
        status: event.status,
        lifecycle,
        createdBy: event.createdBy ? {
          _id: event.createdBy._id.toString(),
          name: event.createdBy.name,
          role: event.createdBy.role
        } : null,
        createdAt: event.createdAt.toISOString()
      }
    };
  } catch (error) {
    console.error('Error fetching event:', error);
    return { success: false, message: error.message };
  }
}

export async function updateEvent(id, formData) {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, message: 'Not authenticated' };
    }
    
    await connectDB();
    
    const user = await getCurrentUser();
    const event = await Event.findById(id);
    
    if (!event) {
      return { success: false, message: 'Event not found' };
    }
    
    // Only the creator or admin can update events
    if (user.role !== 'admin' && event.createdBy.toString() !== user._id.toString()) {
      return { success: false, message: 'You do not have permission to update this event' };
    }
    
    const title = formData.get('title');
    const description = formData.get('description');
    const date = formData.get('date');
    const location = formData.get('location');
    const registrationLink = formData.get('registrationLink');
    const capacity = formData.get('capacity');
    const imageUrl = formData.get('imageUrl');
    const status = formData.get('status');
    
    if (title) event.title = title;
    if (description) event.description = description;
    if (date) event.date = new Date(date);
    if (location) event.location = location;
    if (registrationLink) event.registrationLink = registrationLink;
    if (capacity !== null) event.capacity = capacity ? parseInt(capacity) : null;
    if (imageUrl !== undefined) event.imageUrl = imageUrl;
    if (status) event.status = status;
    
    await event.save();
    
    revalidatePath('/');
    revalidatePath('/events');
    
    return { success: true };
  } catch (error) {
    console.error('Error updating event:', error);
    return { success: false, message: error.message };
  }
}

export async function deleteEvent(id) {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, message: 'Not authenticated' };
    }
    
    await connectDB();
    
    const user = await getCurrentUser();
    const event = await Event.findById(id);
    
    if (!event) {
      return { success: false, message: 'Event not found' };
    }
    
    // Only the creator or admin can delete events
    if (user.role !== 'admin' && event.createdBy.toString() !== user._id.toString()) {
      return { success: false, message: 'You do not have permission to delete this event' };
    }
    
    await Event.findByIdAndDelete(id);
    
    revalidatePath('/');
    revalidatePath('/events');
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting event:', error);
    return { success: false, message: error.message };
  }
}

export async function signup(formData) {
  try {
    const name = formData.get('name');
    const username = formData.get('username');
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');
    const organizationName = formData.get('organizationName');
    const mobile = formData.get('mobile') || '';
    const role = formData.get('role') || 'volunteer';
    const ngoId = formData.get('ngoId') || '';
    const registrationReason = formData.get('registrationReason') || '';
    
    // Existing certificate fields
    const has12A = formData.get('has12A') === 'true';
    const reg12A = formData.get('reg12A') || '';
    const has80G = formData.get('has80G') === 'true';
    const reg80G = formData.get('reg80G') || '';
    const hasFCRA = formData.get('hasFCRA') === 'true';
    const regFCRA = formData.get('regFCRA') || '';

    // ── Validation ──
    if (!name || !username || !password || !confirmPassword) {
      return { success: false, message: 'All fields are required' };
    }

    if (role !== 'volunteer' && !organizationName) {
      return { success: false, message: 'Organization name is required' };
    }

    if (!['volunteer', 'org_member', 'org_spoc', 'ngo', 'employee'].includes(role)) {
      return { success: false, message: 'Invalid role selected' };
    }

    if (password.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters' };
    }

    if (password !== confirmPassword) {
      return { success: false, message: 'Passwords do not match' };
    }

    await connectDB();

    const existingUser = await User.findOne({ username: username.toLowerCase().trim() });
    if (existingUser) {
      return { success: false, message: 'Username already taken' };
    }

    const userData = {
      name: name.trim(),
      username: username.toLowerCase().trim(),
      password,
      role,
      status: 'pending',
      mobile,
      registrationReason,
      has12A, reg12A,
      has80G, reg80G,
      hasFCRA, regFCRA,
    };

    if (role === 'ngo') {
      userData.ngoId = ngoId;
      userData.name = organizationName.trim(); // For NGO, 'organizationName' acts as the user's name
    } else {
      userData.organizationName = organizationName.trim();
    }

    await User.create(userData);

    // Save uploaded documents if any (passed as JSON string)
    const docsJson = formData.get('documents');
    if (docsJson) {
      try {
        const docs = JSON.parse(docsJson);
        if (Array.isArray(docs) && docs.length > 0) {
          const newDocs = docs.map(d => ({
            docType: d.docType,
            label: d.label,
            url: d.url,
            uploadedAt: new Date(),
            status: 'pending',
            adminNote: '',
          }));
          await User.updateOne(
            { username: username.toLowerCase().trim() },
            { $push: { documents: { $each: newDocs } } }
          );
        }
      } catch {}
    }

    return { success: true, pending: true };
  } catch (error) {
    console.error('Signup error:', error);
 
    if (error.code === 11000) {
      return { success: false, message: 'Username already taken' };
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return { success: false, message: messages.join(', ') };
    }
 
    return { success: false, message: 'Server error' };
  }
}

// ── NGO Partners ──────────────────────────────────────────────────────────────

export async function getAllNGOPartners() {
  try {
    await connectDB();
    const partners = await NGOPartner.find().sort({ createdAt: -1 }).lean();
    return {
      success: true,
      partners: partners.map((p) => ({
        _id: p._id.toString(),
        name: p.name,
        description: p.description,
        logoUrl: p.logoUrl || '',
        focusAreas: p.focusAreas || '',
        programs: p.programs || [],
        impact: p.impact || '',
        registeredOffice: p.registeredOffice || '',
        location: p.location || '',
        website: p.website || '',
        createdAt: p.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error('Error fetching NGO partners:', error);
    return { success: false, message: error.message };
  }
}

export async function createNGOPartner(formData) {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    await connectDB();
    const user = await getCurrentUser();
    if (user.role !== 'admin' && user.role !== 'employee') return { success: false, message: 'Only admins and employees can add NGO partners' };

    const name = formData.get('name')?.trim();
    const description = formData.get('description')?.trim();
    const focusAreas = formData.get('focusAreas')?.trim() || '';
    const programsRaw = formData.get('programs')?.trim() || '';
    const programs = programsRaw ? programsRaw.split('\n').map((l) => l.trim()).filter(Boolean) : [];
    const impact = formData.get('impact')?.trim() || '';
    const registeredOffice = formData.get('registeredOffice')?.trim() || '';
    const location = formData.get('location')?.trim() || '';
    const website = formData.get('website')?.trim() || '';
    const logoUrl = formData.get('logoUrl')?.trim() || '';

    if (!name || !description) {
      return { success: false, message: 'Name and description are required' };
    }

    const partner = await NGOPartner.create({ name, description, logoUrl, focusAreas, programs, impact, registeredOffice, location, website });

    revalidatePath('/ngo-partners');
    revalidatePath('/admin/ngo-partners');

    return {
      success: true,
      partner: {
        _id: partner._id.toString(),
        name: partner.name,
        description: partner.description,
        logoUrl: partner.logoUrl,
        focusAreas: partner.focusAreas,
        programs: partner.programs,
        impact: partner.impact,
        registeredOffice: partner.registeredOffice,
        location: partner.location,
        website: partner.website,
        createdAt: partner.createdAt.toISOString(),
      },
    };
  } catch (error) {
    console.error('Error creating NGO partner:', error);
    return { success: false, message: error.message };
  }
}

export async function deleteNGOPartner(id) {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    await connectDB();
    const user = await getCurrentUser();
    if (user.role !== 'admin' && user.role !== 'employee') return { success: false, message: 'Only admins and employees can delete NGO partners' };

    const partner = await NGOPartner.findByIdAndDelete(id);
    if (!partner) return { success: false, message: 'NGO partner not found' };

    revalidatePath('/ngo-partners');
    revalidatePath('/admin/ngo-partners');

    return { success: true };
  } catch (error) {
    console.error('Error deleting NGO partner:', error);
    return { success: false, message: error.message };
  }
}

// ─────────────────────────────────────────────────────────────
// CORPORATE TEAM MANAGEMENT
// ─────────────────────────────────────────────────────────────

/**
 * Generate N pre-approved org_member accounts for a corporate org.
 * Can be called by SPOC (for their own org) or Admin (for any org).
 * Returns array of plain-text credentials for one-time CSV download.
 */
export async function generateTeamLogins(formData) {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    const caller = await getCurrentUser();
    if (caller.role !== 'admin' && caller.role !== 'org_spoc') {
      return { success: false, message: 'Only Admin or SPOC can generate team logins' };
    }

    await connectDB();

    const orgName = formData.get('orgName')?.trim();
    const count   = parseInt(formData.get('count'));

    if (!orgName || !count || count < 1 || count > 500) {
      return { success: false, message: 'Provide a valid org name and count (1–500)' };
    }

    // Org slug: lowercase, spaces → dashes, strip special chars
    const orgSlug = orgName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Find the highest existing index for this org to avoid collisions
    const existing = await User.find({ organizationName: orgName, role: 'org_member' })
      .select('username').lean();
    const existingNums = existing
      .map(u => parseInt(u.username.split('-').pop()))
      .filter(n => !isNaN(n));
    const startIndex = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;

    const plainCredentials = [];
    const usersToCreate    = [];
    const salt = await bcrypt.genSalt(10);

    for (let i = 0; i < count; i++) {
      const idx      = String(startIndex + i).padStart(3, '0');
      const username = `${orgSlug}-${idx}`;
      const password = Math.random().toString(36).slice(2, 10); // 8-char random
      const hashed   = await bcrypt.hash(password, salt);

      usersToCreate.push({
        username,
        password: hashed,
        name: `${orgName} Volunteer ${idx}`,
        role: 'org_member',
        organizationName: orgName,
        status: 'approved',
        spocId: caller.role === 'org_spoc' ? caller._id : null,
        requiresNameUpdate: true,
      });
      plainCredentials.push({ username, password, name: `${orgName} Volunteer ${idx}` });
    }

    await User.insertMany(usersToCreate);
    revalidatePath('/admin/corporate');
    revalidatePath('/dashboard/team');

    return { success: true, credentials: plainCredentials };
  } catch (error) {
    console.error('Error generating team logins:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Bulk create org_member accounts from parsed Excel rows.
 * Each row: { name, username (optional), email (optional) }
 */
export async function bulkCreateFromExcel(rows, orgName, spocId = null) {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    const caller = await getCurrentUser();
    if (caller.role !== 'admin' && caller.role !== 'org_spoc') {
      return { success: false, message: 'Only Admin or SPOC can bulk create accounts' };
    }

    await connectDB();

    if (!rows?.length || !orgName) {
      return { success: false, message: 'Rows and org name are required' };
    }

    const orgSlug = orgName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const salt    = await bcrypt.genSalt(10);
    const plainCredentials = [];
    const usersToCreate    = [];

    for (let i = 0; i < rows.length; i++) {
      const row      = rows[i];
      const username = row.username?.trim() || `${orgSlug}-emp-${Date.now()}-${i}`;
      const name     = row.name?.trim() || `${orgName} Volunteer ${i + 1}`;
      const password = Math.random().toString(36).slice(2, 10);
      const hashed   = await bcrypt.hash(password, salt);

      usersToCreate.push({
        username,
        password: hashed,
        name,
        role: 'org_member',
        organizationName: orgName,
        status: 'approved',
        spocId: spocId || (caller.role === 'org_spoc' ? caller._id : null),
      });
      plainCredentials.push({ username, password, name });
    }

    await User.insertMany(usersToCreate);
    revalidatePath('/admin/corporate');
    revalidatePath('/dashboard/team');

    return { success: true, credentials: plainCredentials };
  } catch (error) {
    console.error('Error bulk creating accounts:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Get all org_member users for an organization.
 */
export async function getOrgMembers(orgName) {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    await connectDB();

    const members = await User.find({ organizationName: orgName, role: 'org_member' })
      .select('-password').lean();

    return {
      success: true,
      members: members.map(m => ({
        _id: m._id.toString(),
        username: m.username,
        name: m.name,
        status: m.status,
        totalVolunteerHours: m.totalVolunteerHours || 0,
        createdAt: m.createdAt ? m.createdAt.toISOString() : null,
      }))
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// ─────────────────────────────────────────────────────────────
// ATTENDANCE & VOLUNTEER HOURS
// ─────────────────────────────────────────────────────────────

/**
 * Bulk mark attendance for an event.
 * attendanceList: [{ userId, attended, hoursContributed, feedbackScore }]
 */
export async function markAttendance(eventId, attendanceList) {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    const caller = await getCurrentUser();
    if (caller.role !== 'admin' && caller.role !== 'org_spoc') {
      return { success: false, message: 'Only Admin or SPOC can mark attendance' };
    }

    await connectDB();

    const now = new Date();
    const ops = attendanceList.map(entry => ({
      updateOne: {
        filter: { eventId, userId: entry.userId },
        update: {
          $set: {
            organizationName: caller.organizationName || entry.organizationName,
            attended: entry.attended ?? false,
            hoursContributed: entry.hoursContributed ?? 0,
            feedbackScore: entry.feedbackScore || null,
            markedAt: now,
            markedBy: caller._id,
          }
        },
        upsert: true,
      }
    }));

    await Attendance.bulkWrite(ops);

    // Update cached totalVolunteerHours for each user that attended
    const attended = attendanceList.filter(e => e.attended && e.hoursContributed > 0);
    for (const entry of attended) {
      await User.findByIdAndUpdate(entry.userId, {
        $inc: { totalVolunteerHours: entry.hoursContributed }
      });
    }

    revalidatePath('/dashboard');
    revalidatePath('/admin/corporate');

    return { success: true };
  } catch (error) {
    console.error('Error marking attendance:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Get attendance list for a specific event + org.
 */
export async function getEventAttendance(eventId, orgName) {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    await connectDB();

    const filter = { eventId };
    if (orgName) filter.organizationName = orgName;

    const records = await Attendance.find(filter)
      .populate('userId', 'name username')
      .lean();

    return {
      success: true,
      records: records.map(r => ({
        _id: r._id.toString(),
        userId: r.userId._id.toString(),
        name: r.userId.name,
        username: r.userId.username,
        attended: r.attended,
        hoursContributed: r.hoursContributed,
        feedbackScore: r.feedbackScore,
        markedAt: r.markedAt ? r.markedAt.toISOString() : null,
      }))
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// ─────────────────────────────────────────────────────────────
// CORPORATE KPI STATS
// ─────────────────────────────────────────────────────────────

/**
 * Get full KPI stats for a corporate org (used by SPOC dashboard and Admin drill-down).
 */
export async function getOrgStats(orgName) {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    await connectDB();

    // Total members
    const totalVolunteers = await User.countDocuments({ organizationName: orgName, role: 'org_member' });

    // Aggregate from Attendance
    const agg = await Attendance.aggregate([
      { $match: { organizationName: orgName, attended: true } },
      {
        $group: {
          _id: null,
          totalHours:      { $sum: '$hoursContributed' },
          totalEvents:     { $addToSet: '$eventId' },
          avgFeedback:     { $avg: '$feedbackScore' },
          attendanceCount: { $sum: 1 },
        }
      }
    ]);

    const stats = agg[0] || {};

    // Monthly participation (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthly = await Attendance.aggregate([
      { $match: { organizationName: orgName, attended: true, markedAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year:  { $year: '$markedAt' },
            month: { $month: '$markedAt' },
          },
          count: { $sum: 1 },
          hours: { $sum: '$hoursContributed' },
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Unique NGOs engaged (via events)
    const eventIds = stats.totalEvents || [];
    const eventsData = await Event.find({ _id: { $in: eventIds } })
      .select('title date location organizationName createdBy beneficiariesImpacted').populate('createdBy', 'ngoId').lean();
    const ngoIds = [...new Set(eventsData.map(e => e.createdBy?.ngoId).filter(Boolean))];
    const totalBeneficiaries = eventsData.reduce((s, e) => s + (e.beneficiariesImpacted || 0), 0);

    // Aggregate attendance per event for detail list
    const eventAttendanceDetails = await Attendance.aggregate([
      { $match: { organizationName: orgName, attended: true } },
      {
        $group: {
          _id: '$eventId',
          hours: { $sum: '$hoursContributed' },
          attendees: { $sum: 1 }
        }
      }
    ]);

    const eventsList = eventAttendanceDetails.map(detail => {
      const ev = eventsData.find(e => e._id.toString() === detail._id.toString());
      if (!ev) return null;
      return {
        _id: ev._id.toString(),
        title: ev.title,
        date: ev.date.toISOString(),
        location: ev.location,
        hours: detail.hours,
        attendees: detail.attendees,
        isCorporate: !!ev.organizationName, // corporate/personal vs global
      };
    }).filter(Boolean);

    return {
      success: true,
      stats: {
        totalVolunteers,
        volunteerHours:         stats.totalHours || 0,
        eventsAttended:         (stats.totalEvents || []).length,
        ngosEngaged:            ngoIds.length,
        beneficiariesImpacted:  totalBeneficiaries,
        avgFeedback:            stats.avgFeedback ? Math.round(stats.avgFeedback * 10) / 10 : null,
        participationRate:      totalVolunteers > 0
          ? Math.round(((stats.attendanceCount || 0) / totalVolunteers) * 100)
          : 0,
      },
      monthly: monthly.map(m => ({
        month: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`,
        label: new Date(m._id.year, m._id.month - 1).toLocaleString('default', { month: 'short', year: '2-digit' }),
        count: m.count,
        hours: m.hours,
      })),
      eventsList
    };
  } catch (error) {
    console.error('Error getting org stats:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Get all corporate orgs summary for admin overview.
 */
export async function getAllCorporateStats() {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    const caller = await getCurrentUser();
    if (caller.role !== 'admin') return { success: false, message: 'Admin only' };

    await connectDB();

    // Get all distinct orgs with their SPOCs
    const spocs = await User.find({ role: 'org_spoc', status: 'approved' })
      .select('name organizationName status createdAt').lean();

    const orgs = await Promise.all(spocs.map(async spoc => {
      const memberCount = await User.countDocuments({
        organizationName: spoc.organizationName,
        role: 'org_member',
      });
      const agg = await Attendance.aggregate([
        { $match: { organizationName: spoc.organizationName, attended: true } },
        { $group: { _id: null, hours: { $sum: '$hoursContributed' }, events: { $addToSet: '$eventId' } } }
      ]);
      const a = agg[0] || {};
      return {
        spocId:          spoc._id.toString(),
        spocName:        spoc.name,
        organizationName: spoc.organizationName,
        memberCount,
        volunteerHours:  a.hours || 0,
        eventsAttended:  (a.events || []).length,
        joinedAt:        spoc.createdAt ? spoc.createdAt.toISOString() : null,
      };
    }));

    return { success: true, orgs };
  } catch (error) {
    console.error('Error getting all corporate stats:', error);
    return { success: false, message: error.message };
  }
}

// ─────────────────────────────────────────────────────────────
// NGO DOCUMENT VAULT
// ─────────────────────────────────────────────────────────────

/**
 * NGO uploads a certificate document (URL already uploaded to Cloudinary).
 */
export async function uploadNGODocument(formData) {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    const caller = await getCurrentUser();
    if (caller.role !== 'ngo') return { success: false, message: 'Only NGO users can upload documents' };

    await connectDB();

    const docType = formData.get('docType');
    const label   = formData.get('label')?.trim();
    const url     = formData.get('url');

    if (!docType || !label || !url) {
      return { success: false, message: 'Document type, label, and file URL are required' };
    }

    const newDoc = { docType, label, url, uploadedAt: new Date(), status: 'pending', adminNote: '' };

    await User.findByIdAndUpdate(caller._id, { $push: { documents: newDoc } });
    revalidatePath('/dashboard/documents');
    revalidatePath('/admin/ngo-documents');

    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Get all documents for the current NGO user.
 */
export async function getNGODocuments() {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    await connectDB();
    const caller = await getCurrentUser();

    const user = await User.findById(caller._id).select('documents').lean();
    return {
      success: true,
      documents: (user.documents || []).map(d => ({
        _id: d._id.toString(),
        docType: d.docType,
        label: d.label,
        url: d.url,
        uploadedAt: d.uploadedAt?.toISOString() || null,
        status: d.status,
        adminNote: d.adminNote,
      }))
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Admin fetches all NGOs with their document summaries.
 */
export async function getAllNGODocuments() {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    const caller = await getCurrentUser();
    if (caller.role !== 'admin') return { success: false, message: 'Admin only' };

    await connectDB();

    const ngos = await User.find({ role: 'ngo' })
      .select('name ngoId username mobile documents').lean();

    return {
      success: true,
      ngos: ngos.map(ngo => ({
        _id: ngo._id.toString(),
        name: ngo.name,
        ngoId: ngo.ngoId,
        username: ngo.username,
        mobile: ngo.mobile || '',
        documents: (ngo.documents || []).map(d => ({
          _id: d._id.toString(),
          docType: d.docType,
          label: d.label,
          url: d.url,
          uploadedAt: d.uploadedAt?.toISOString() || null,
          status: d.status,
          adminNote: d.adminNote,
        })),
        pendingCount:  (ngo.documents || []).filter(d => d.status === 'pending').length,
        verifiedCount: (ngo.documents || []).filter(d => d.status === 'verified').length,
      }))
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Admin verifies or rejects an NGO document.
 */
export async function reviewNGODocument(ngoUserId, docId, status, adminNote = '') {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    const caller = await getCurrentUser();
    if (caller.role !== 'admin') return { success: false, message: 'Admin only' };

    await connectDB();

    await User.updateOne(
      { _id: ngoUserId, 'documents._id': docId },
      { $set: { 'documents.$.status': status, 'documents.$.adminNote': adminNote } }
    );

    revalidatePath('/admin/ngo-documents');
    revalidatePath('/dashboard/documents');

    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Delete an NGO document (by the NGO owner).
 */
export async function deleteNGODocument(docId) {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    const caller = await getCurrentUser();
    await connectDB();

    await User.findByIdAndUpdate(caller._id, {
      $pull: { documents: { _id: docId } }
    });

    revalidatePath('/dashboard/documents');
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

export async function updateMemberName(newName) {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    await connectDB();
    const caller = await getCurrentUser();
    if (!caller) return { success: false, message: 'User not found' };

    const nameToSave = newName?.trim();
    if (!nameToSave || nameToSave.length < 2) {
      return { success: false, message: 'Please provide a valid name (at least 2 characters).' };
    }

    await User.updateOne(
      { _id: caller._id },
      { $set: { name: nameToSave, requiresNameUpdate: false } }
    );

    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Error updating member name:', error);
    return { success: false, message: error.message };
  }
}

// ─────────────────────────────────────────────────────────────
// ORG MEMBER SELF-REPORTING (Hours & Feedback)
// ─────────────────────────────────────────────────────────────

/**
 * Org member logs their own hours and feedback for a past event.
 */
export async function logMyHoursAndFeedback(eventId, hours, feedbackScore) {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    const caller = await getCurrentUser();
    if (caller.role !== 'org_member') return { success: false, message: 'Only org members can self-report' };

    await connectDB();

    const event = await Event.findById(eventId).lean();
    if (!event) return { success: false, message: 'Event not found' };

    const eventDate = new Date(event.date);
    if (eventDate > new Date()) {
      return { success: false, message: 'You can only log hours for past events' };
    }

    if (hours < 0 || hours > 24) {
      return { success: false, message: 'Please enter a valid number of hours (0-24)' };
    }

    const existing = await Attendance.findOne({ eventId, userId: caller._id });
    if (!existing || !existing.attended) {
      return { success: false, message: 'You can only log hours after your SPOC or Admin has marked your attendance for this event.' };
    }

    await Attendance.findOneAndUpdate(
      { eventId, userId: caller._id },
      {
        $set: {
          hoursContributed: hours,
          feedbackScore: feedbackScore || null,
        }
      },
      { new: true }
    );

    // Update cached total volunteer hours (diff if updating)
    const prevHours = existing?.hoursContributed || 0;
    const diff = hours - prevHours;
    if (diff !== 0) {
      await User.findByIdAndUpdate(caller._id, { $inc: { totalVolunteerHours: diff } });
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/my-impact');
    return { success: true };
  } catch (error) {
    console.error('Error logging hours:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Get all events with the member's attendance/hours logged, plus personal stats.
 */
export async function getMyImpact() {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    const caller = await getCurrentUser();
    if (!['org_member', 'volunteer'].includes(caller.role)) return { success: false, message: 'Volunteers and Org Members only' };

    await connectDB();

    // Get only events the user has registered for (participated in)
    const registeredEventIds = (caller.eventRegistrations || []).map(r => r.eventId);
    const allEvents = await Event.find({ _id: { $in: registeredEventIds } })
      .select('title date location description beneficiariesImpacted status durationHours organizationName')
      .sort({ date: -1 })
      .lean();

    // Get this member's attendance records
    const myRecords = await Attendance.find({ userId: caller._id }).lean();
    const recordMap = {};
    for (const r of myRecords) {
      recordMap[r.eventId.toString()] = r;
    }
    const now = new Date();
    
    const events = allEvents.map(ev => {
      const rec = recordMap[ev._id.toString()];
      const start = new Date(ev.date);
      const end = new Date(start.getTime() + (ev.durationHours || 2) * 60 * 60 * 1000);
      let lifecycle = 'upcoming';
      if (now > end) lifecycle = 'ended';
      else if (now >= start && now <= end) lifecycle = 'live';

      const registration = (caller.eventRegistrations || []).find(r => r.eventId.toString() === ev._id.toString());
      
      return {
        _id: ev._id.toString(),
        title: ev.title,
        date: ev.date.toISOString(),
        location: ev.location,
        description: ev.description,
        durationHours: ev.durationHours || 2,
        beneficiariesImpacted: ev.beneficiariesImpacted || 0,
        status: ev.status,
        lifecycle,
        isPast: lifecycle === 'ended',
        myRegistrationStatus: registration ? registration.status : null,
        myHours: rec?.hoursContributed || 0,
        myFeedback: rec?.feedbackScore || null,
        attended: rec?.attended || false,
        organizationName: ev.organizationName || null,
      };
    });

    const totalHours = myRecords.reduce((s, r) => s + (r.hoursContributed || 0), 0);
    const eventsAttended = myRecords.filter(r => r.attended).length;
    const feedbacks = myRecords.filter(r => r.feedbackScore);
    const avgFeedback = feedbacks.length
      ? Math.round((feedbacks.reduce((s, r) => s + r.feedbackScore, 0) / feedbacks.length) * 10) / 10
      : null;

    return {
      success: true,
      events,
      stats: {
        totalHours,
        eventsAttended,
        avgFeedback,
        name: caller.name,
        organizationName: caller.organizationName,
      }
    };
  } catch (error) {
    console.error('Error getting my impact:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Admin uploads a document on behalf of an NGO user.
 */
export async function adminUploadNGODocument(ngoUserId, docType, label, url) {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    const caller = await getCurrentUser();
    if (caller.role !== 'admin' && caller.role !== 'employee') return { success: false, message: 'Unauthorized' };

    await connectDB();

    const newDoc = {
      docType,
      label,
      url,
      uploadedAt: new Date(),
      status: 'verified', // Admin-uploaded docs are auto-verified
      adminNote: 'Uploaded by admin',
    };

    await User.findByIdAndUpdate(ngoUserId, { $push: { documents: newDoc } });

    revalidatePath('/admin/ngo-documents');
    revalidatePath('/dashboard/documents');
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

export async function registerForEvent(formData, eventId) {
  try {
    await connectDB();
    
    const event = await Event.findById(eventId);
    if (!event) return { success: false, message: 'Event not found' };

    if (event.organizationName) {
      return { success: false, message: 'This is a private corporate event. Guest registration is not allowed.' };
    }

    const start = new Date(event.date);
    const end = new Date(start.getTime() + (event.durationHours || 2) * 60 * 60 * 1000);
    if (new Date() > end) {
      return { success: false, message: 'Registration is closed. This event has ended.' };
    }

    // Capacity check
    if (event.capacity) {
      const registeredUsers = await User.find({ 'eventRegistrations.eventId': eventId, 'eventRegistrations.status': { $in: ['pending', 'approved'] } });
      const totalRegistered = registeredUsers.reduce((sum, u) => {
        const reg = u.eventRegistrations.find(r => r.eventId.toString() === eventId.toString());
        return sum + (reg ? (reg.volunteersCount || 1) : 0);
      }, 0);
      if (totalRegistered >= event.capacity) {
        return { success: false, message: 'This event is fully booked. No spots remaining.' };
      }
    }

    const username = formData.get('username');
    const password = formData.get('password');
    const name = formData.get('name');
    const age = formData.get('age');
    const mobile = formData.get('mobile');
    const email = formData.get('email');
    const photoUrl = formData.get('photoUrl');
    
    if (!username || !password || !name) {
      return { success: false, message: 'Username, password and name are required' };
    }
    
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return { success: false, message: 'Username already exists' };
    }
    
    const userData = {
      username,
      password,
      role: 'volunteer',
      name,
      status: 'pending',
      age: age ? parseInt(age, 10) : null,
      mobile: mobile || '',
      email: email || '',
      photoUrl: photoUrl || '',
      eventRegistrations: [{
        eventId,
        status: 'pending',
        comment: `I want to volunteer for this event: ${event.title}`,
        appliedAt: new Date()
      }]
    };
    
    await User.create(userData);
    
    revalidatePath('/admin/users');
    revalidatePath('/dashboard/registrations');
    return { success: true, pending: true };
  } catch (error) {
    console.error('Event registration error:', error);
    return { success: false, message: error.message };
  }
}

export async function registerForEventLoggedIn(eventId, comment, volunteersCount = 1, volunteerNames = '') {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    await connectDB();
    const currentUser = await getCurrentUser();

    const event = await Event.findById(eventId).populate('createdBy');
    if (!event) return { success: false, message: 'Event not found' };

    // Role-based registration restrictions for internal/global events
    if (event.organizationName) {
      // It's a private internal corporate event
      if (currentUser.role === 'org_member') {
        if (!currentUser.spocId || event.createdBy._id.toString() !== currentUser.spocId.toString()) {
          return { success: false, message: 'Only members whose logins are created by the hosting SPOC can register for this event.' };
        }
      } else if (currentUser.role === 'org_spoc') {
        if (event.createdBy._id.toString() === currentUser._id.toString()) {
          return { success: false, message: 'This is an internal event created by you. You can ask your volunteers to participate.' };
        } else {
          return { success: false, message: 'Only corporate members of the hosting organization can register for this event.' };
        }
      } else {
        return { success: false, message: 'Only corporate members of this organization can register for this event.' };
      }
    } else {
      // It's a global event
      if (currentUser.role === 'org_member') {
        const spocDoc = await User.findOne({
          role: 'org_spoc',
          organizationName: currentUser.organizationName,
          'eventRegistrations.eventId': eventId
        });
        if (!spocDoc) {
          return { success: false, message: 'Your SPOC has not registered your organization for this event yet. Please contact your SPOC.' };
        }
      }
    }

    const start = new Date(event.date);
    const end = new Date(start.getTime() + (event.durationHours || 2) * 60 * 60 * 1000);
    if (new Date() > end) {
      return { success: false, message: 'Registration is closed. This event has ended.' };
    }

    const user = await User.findById(currentUser._id);
    
    // Check if already registered
    const alreadyRegistered = user.eventRegistrations.some(r => r.eventId.toString() === eventId.toString());
    if (alreadyRegistered) {
      return { success: false, message: 'You are already registered for this event' };
    }

    // Capacity check
    if (event.capacity) {
      const registeredUsers = await User.find({ 'eventRegistrations.eventId': eventId, 'eventRegistrations.status': { $in: ['pending', 'approved'] } });
      const totalRegistered = registeredUsers.reduce((sum, u) => {
        const reg = u.eventRegistrations.find(r => r.eventId.toString() === eventId.toString());
        return sum + (reg ? (reg.volunteersCount || 1) : 0);
      }, 0);
      const incomingCount = currentUser.role === 'org_spoc' ? (parseInt(volunteersCount) || 1) : 1;
      if (totalRegistered + incomingCount > event.capacity) {
        const spotsLeft = event.capacity - totalRegistered;
        if (spotsLeft <= 0) return { success: false, message: 'This event is fully booked. No spots remaining.' };
        return { success: false, message: `Only ${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left. You requested ${incomingCount}.` };
      }
    }

    // Auto-approve all registrations
    let status = 'approved';

    const count = currentUser.role === 'org_spoc' ? (parseInt(volunteersCount) || 1) : 1;

    user.eventRegistrations.push({
      eventId,
      status,
      comment: comment || `Registering ${count} volunteer${count > 1 ? 's' : ''} for: ${event.title}`,
      volunteersCount: count,
      volunteerNames: volunteerNames || '',
      appliedAt: new Date()
    });

    await user.save();
    
    revalidatePath('/dashboard/my-impact');
    revalidatePath('/dashboard/registrations');
    return { success: true, status };
  } catch (error) {
    console.error('Logged in registration error:', error);
    return { success: false, message: error.message };
  }
}

export async function updateEventRegistrationStatus(formData) {
  const session = await getSession();
  if (!session) return { success: false, message: 'Not authenticated' };

  try {
    await connectDB();
    const currentUser = await getCurrentUser();

    const userId = formData.get('userId');
    const eventId = formData.get('eventId');
    const status = formData.get('status');

    if (!['approved', 'rejected'].includes(status)) {
      return { success: false, message: 'Invalid status' };
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) return { success: false, message: 'User not found' };

    const regIndex = targetUser.eventRegistrations.findIndex(r => r.eventId.toString() === eventId.toString());
    if (regIndex === -1) return { success: false, message: 'Registration not found' };

    const event = await Event.findById(eventId);

    if (currentUser.role !== 'admin') {
      if (event.createdBy.toString() !== currentUser._id.toString()) {
        return { success: false, message: 'Not authorized. This user registered for another organizer\'s event.' };
      }
    }

    targetUser.eventRegistrations[regIndex].status = status;
    await targetUser.save();

    revalidatePath('/admin/users');
    revalidatePath('/dashboard/registrations');
    return { success: true };
  } catch (error) {
    console.error('Error updating event registration status:', error);
    return { success: false, message: error.message };
  }
}

export async function getImpactPhotos() {
  try {
    await connectDB();
    const photos = await ImpactPhoto.find().sort({ createdAt: -1 }).lean();
    return { success: true, photos: photos.map(p => ({ ...p, _id: p._id.toString() })) };
  } catch (error) {
    console.error('Error fetching impact photos:', error);
    return { success: false, message: error.message };
  }
}

export async function addImpactPhoto(url, publicId) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return { success: false, message: 'Not authorized' };
    }

    await connectDB();
    const photo = await ImpactPhoto.create({ url, publicId });
    revalidatePath('/');
    return { success: true, photo: { ...photo.toObject(), _id: photo._id.toString() } };
  } catch (error) {
    console.error('Error adding impact photo:', error);
    return { success: false, message: error.message };
  }
}

export async function deleteImpactPhoto(id) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return { success: false, message: 'Not authorized' };
    }

    await connectDB();
    const photo = await ImpactPhoto.findByIdAndDelete(id);
    if (!photo) return { success: false, message: 'Photo not found' };

    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Error deleting impact photo:', error);
    return { success: false, message: error.message };
  }
}

// ── CHAT / MESSAGING ──────────────────────────────────────────────────────────

export async function getChatContacts() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, message: 'Not authenticated' };
    await connectDB();

    let contacts = [];

    if (currentUser.role === 'admin') {
      // Admin can chat: NGOs, SPOCs, and Employees
      contacts = await User.find({ role: { $in: ['ngo', 'org_spoc', 'employee'] } })
        .select('name role organizationName ngoId')
        .lean();
    } else if (currentUser.role === 'ngo') {
      // NGO can chat: Admins only
      contacts = await User.find({ role: 'admin' })
        .select('name role organizationName ngoId')
        .lean();
    } else if (currentUser.role === 'org_spoc') {
      // SPOC can chat: Admins and their own org members only
      const [admins, members] = await Promise.all([
        User.find({ role: 'admin' })
          .select('name role organizationName ngoId').lean(),
        User.find({ role: 'org_member', organizationName: currentUser.organizationName })
          .select('name role organizationName ngoId').lean(),
      ]);
      contacts = [...admins, ...members];
    } else if (currentUser.role === 'employee') {
      // Employee can only chat with Admin
      contacts = await User.find({ role: 'admin' })
        .select('name role organizationName ngoId')
        .lean();
    } else if (currentUser.role === 'org_member') {
      // Org member can only chat with their SPOC
      contacts = await User.find({ role: 'org_spoc', organizationName: currentUser.organizationName })
        .select('name role organizationName ngoId')
        .lean();
    } else {
      return { success: false, message: 'Chat not available for your role' };
    }

    const unreadCounts = await Message.aggregate([
      { $match: { receiver: currentUser._id, read: false } },
      { $group: { _id: '$sender', count: { $sum: 1 } } },
    ]);
    const unreadMap = {};
    unreadCounts.forEach((u) => { unreadMap[u._id.toString()] = u.count; });

    const serialized = contacts.map((c) => ({
      _id: c._id.toString(),
      name: c.name,
      role: c.role,
      organizationName: c.organizationName || null,
      ngoId: c.ngoId || null,
      unread: unreadMap[c._id.toString()] || 0,
    }));

    return { success: true, contacts: serialized };
  } catch (error) {
    console.error('Error getting chat contacts:', error);
    return { success: false, message: error.message };
  }
}

export async function getMessages(contactId) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, message: 'Not authenticated' };
    await connectDB();

    const mongoose = (await import('mongoose')).default;
    const cId = new mongoose.Types.ObjectId(contactId);
    const meId = currentUser._id;

    await Message.updateMany(
      { sender: cId, receiver: meId, read: false },
      { $set: { read: true } }
    );

    const messages = await Message.find({
      $or: [
        { sender: meId, receiver: cId },
        { sender: cId, receiver: meId },
      ],
    })
      .populate('sender', 'name role')
      .sort({ createdAt: 1 })
      .lean();

    const serialized = messages.map((m) => ({
      _id: m._id.toString(),
      content: m.content,
      fileUrl: m.fileUrl || null,
      fileName: m.fileName || null,
      fileType: m.fileType || null,
      read: m.read,
      createdAt: m.createdAt.toISOString(),
      sender: {
        _id: m.sender._id.toString(),
        name: m.sender.name,
        role: m.sender.role,
      },
      isMine: m.sender._id.toString() === meId.toString(),
    }));

    return { success: true, messages: serialized };
  } catch (error) {
    console.error('Error getting messages:', error);
    return { success: false, message: error.message };
  }
}

export async function sendMessage(formData) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, message: 'Not authenticated' };
    if (!['admin', 'ngo', 'org_spoc', 'employee', 'org_member'].includes(currentUser.role)) {
      return { success: false, message: 'Chat not available for your role' };
    }
    await connectDB();

    const receiverId = formData.get('receiverId');
    const content = formData.get('content')?.trim() || '';
    const fileUrl = formData.get('fileUrl') || null;
    const fileName = formData.get('fileName') || null;
    const fileType = formData.get('fileType') || null;

    if (!receiverId) return { success: false, message: 'Receiver is required' };
    if (!content && !fileUrl) return { success: false, message: 'Message or file is required' };

    const mongoose = (await import('mongoose')).default;
    const message = await Message.create({
      sender: currentUser._id,
      receiver: new mongoose.Types.ObjectId(receiverId),
      content,
      fileUrl,
      fileName,
      fileType,
    });

    return {
      success: true,
      message: {
        _id: message._id.toString(),
        content: message.content,
        fileUrl: message.fileUrl,
        fileName: message.fileName,
        fileType: message.fileType,
        read: message.read,
        createdAt: message.createdAt.toISOString(),
        sender: { _id: currentUser._id.toString(), name: currentUser.name, role: currentUser.role },
        isMine: true,
      },
    };
  } catch (error) {
    console.error('Error sending message:', error);
    return { success: false, message: error.message };
  }
}

export async function getUnreadCount() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { count: 0 };
    await connectDB();
    const count = await Message.countDocuments({ receiver: currentUser._id, read: false });
    return { count };
  } catch {
    return { count: 0 };
  }
}

// Live impact stats for homepage
export async function getImpactStats() {
  try {
    await connectDB();
    const [totalHoursResult, completedEvents, ngoCount, orgUsers] = await Promise.all([
      User.aggregate([{ $group: { _id: null, total: { $sum: '$totalVolunteerHours' } } }]),
      Event.countDocuments({ status: 'completed' }),
      NGOPartner.countDocuments(),
      User.distinct('organizationName', { organizationName: { $ne: null } }),
    ]);
    const totalHours = totalHoursResult[0]?.total || 0;
    return {
      success: true,
      stats: {
        volunteerHours: totalHours,
        eventsCompleted: completedEvents,
        ngoPartners: ngoCount,
        organisations: orgUsers.length,
      }
    };
  } catch (error) {
    return { success: false, stats: { volunteerHours: 0, eventsCompleted: 0, ngoPartners: 0, organisations: 0 } };
  }
}

// Get registered count for an event (for capacity display and breakdown)
export async function getEventRegisteredCount(eventId) {
  try {
    await connectDB();
    const registeredUsers = await User.find({
      'eventRegistrations.eventId': eventId,
      'eventRegistrations.status': 'approved'
    });
    
    let spocCount = 0;
    let totalCount = 0;

    registeredUsers.forEach((u) => {
      const reg = u.eventRegistrations.find(r => r.eventId.toString() === eventId.toString());
      const count = reg ? (reg.volunteersCount || 1) : 0;
      totalCount += count;
      if (u.role === 'org_spoc') {
        spocCount += 1;
      }
    });

    return { success: true, count: totalCount, spocCount, volunteerCount: totalCount };
  } catch {
    return { success: true, count: 0, spocCount: 0, volunteerCount: 0 };
  }
}

// Get admin-wide dashboard impact analytics
export async function getAdminImpactStats() {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };
    const user = await getCurrentUser();
    if (user.role !== 'admin') return { success: false, message: 'Admin access required' };

    await connectDB();

    // 1. Total KPI counters
    const [totalHoursResult, totalBeneficiariesResult, totalEvents, totalNGOs, totalOrgs] = await Promise.all([
      Attendance.aggregate([{ $match: { attended: true } }, { $group: { _id: null, total: { $sum: '$hoursContributed' } } }]),
      Event.aggregate([{ $match: { status: 'completed' } }, { $group: { _id: null, total: { $sum: '$beneficiariesImpacted' } } }]),
      Event.countDocuments({ status: 'completed' }),
      NGOPartner.countDocuments(),
      User.distinct('organizationName', { organizationName: { $ne: null } }),
    ]);

    const totalHours = totalHoursResult[0]?.total || 0;
    const totalBeneficiaries = totalBeneficiariesResult[0]?.total || 0;

    // 2. Events completed by month (past 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const recentEvents = await Event.find({ status: 'completed', date: { $gte: sixMonthsAgo } }).select('date').lean();
    
    const monthlyEventsMap = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mLabel = d.toLocaleString('default', { month: 'short' });
      monthlyEventsMap[mLabel] = 0;
    }

    recentEvents.forEach(e => {
      const mLabel = new Date(e.date).toLocaleString('default', { month: 'short' });
      if (mLabel in monthlyEventsMap) {
        monthlyEventsMap[mLabel]++;
      }
    });

    const monthlyEvents = Object.keys(monthlyEventsMap).map(key => ({
      month: key,
      count: monthlyEventsMap[key]
    }));

    // 3. Top corporate organisations by volunteer hours
    const orgStats = await Attendance.aggregate([
      { $match: { attended: true } },
      { $group: {
        _id: '$organizationName',
        hours: { $sum: '$hoursContributed' },
        volunteers: { $sum: 1 }
      }},
      { $sort: { hours: -1 } },
      { $limit: 6 }
    ]);

    const topOrgs = orgStats.map(o => ({
      name: o._id || 'Individual',
      hours: o.hours,
      volunteers: o.volunteers
    }));

    return {
      success: true,
      stats: {
        totalHours,
        totalBeneficiaries,
        totalEvents,
        totalNGOs,
        totalOrgs: totalOrgs.length,
        monthlyEvents,
        topOrgs
      }
    };
  } catch (error) {
    console.error('Error generating admin impact stats:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Get all events history with creation, registration, and attendance details.
 */
export async function getAllEventsHistory() {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    const caller = await getCurrentUser();
    if (caller.role !== 'admin' && caller.role !== 'employee') {
      return { success: false, message: 'Unauthorized' };
    }

    await connectDB();

    // Get all events
    const events = await Event.find()
      .populate('createdBy', 'name role organizationName')
      .sort({ date: -1 })
      .lean();

    // Aggregate joined count and spoc count from User model
    const registrationsAgg = await User.aggregate([
      { $unwind: '$eventRegistrations' },
      { $match: { 'eventRegistrations.status': 'approved' } },
      {
        $group: {
          _id: '$eventRegistrations.eventId',
          joinedCount: { $sum: { $ifNull: ['$eventRegistrations.volunteersCount', 1] } },
          spocCount: {
            $sum: { $cond: [{ $eq: ['$role', 'org_spoc'] }, 1, 0] }
          }
        }
      }
    ]);
    const regsMap = registrationsAgg.reduce((acc, curr) => {
      acc[curr._id.toString()] = {
        joinedCount: curr.joinedCount,
        spocCount: curr.spocCount
      };
      return acc;
    }, {});

    // Aggregate attendance and hours from Attendance model
    const attendanceAgg = await Attendance.aggregate([
      { $match: { attended: true } },
      {
        $group: {
          _id: '$eventId',
          attendanceCount: { $sum: 1 },
          hoursLogged: { $sum: '$hoursContributed' }
        }
      }
    ]);
    const attsMap = attendanceAgg.reduce((acc, curr) => {
      acc[curr._id.toString()] = {
        attendanceCount: curr.attendanceCount,
        hoursLogged: curr.hoursLogged
      };
      return acc;
    }, {});

    const history = events.map(event => {
      const eId = event._id.toString();
      const regData = regsMap[eId] || { joinedCount: 0, spocCount: 0 };
      const attData = attsMap[eId] || { attendanceCount: 0, hoursLogged: 0 };

      return {
        _id: eId,
        title: event.title,
        date: event.date.toISOString(),
        location: event.location,
        capacity: event.capacity,
        status: event.status,
        organizationName: event.organizationName || null,
        createdBy: event.createdBy ? {
          _id: event.createdBy._id.toString(),
          name: event.createdBy.name,
          role: event.createdBy.role,
          organizationName: event.createdBy.organizationName || null,
        } : null,
        joinedCount: regData.joinedCount,
        spocCount: regData.spocCount,
        attendanceCount: attData.attendanceCount,
        hoursLogged: attData.hoursLogged,
      };
    });

    return { success: true, history };
  } catch (error) {
    console.error('Error getting all events history:', error);
    return { success: false, message: error.message };
  }
}

export async function getMyAnnouncements() {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    await connectDB();
    // Assuming Announcement model will be imported at top, or we can just require it
    const Announcement = (await import('@/models/Announcement')).default;
    
    const announcements = await Announcement.find({ recipient: session.userId })
      .sort({ createdAt: -1 })
      .lean();

    return {
      success: true,
      announcements: announcements.map(a => ({
        ...a,
        _id: a._id.toString(),
        recipient: a.recipient.toString(),
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      }))
    };
  } catch (error) {
    console.error('Error getting announcements:', error);
    return { success: false, message: error.message };
  }
}

export async function markAnnouncementRead(announcementId) {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    await connectDB();
    const Announcement = (await import('@/models/Announcement')).default;

    await Announcement.findOneAndUpdate(
      { _id: announcementId, recipient: session.userId },
      { read: true }
    );
    
    return { success: true };
  } catch (error) {
    console.error('Error marking announcement read:', error);
    return { success: false, message: error.message };
  }
}
