'use server'

import connectDB from '@/lib/db';
import Report from '@/models/Report';
import User from '@/models/User';
import Event from '@/models/Event';
import NGOPartner from '@/models/NGOPartner';
import Attendance from '@/models/Attendance';
import ImpactPhoto from '@/models/ImpactPhoto';
import Message from '@/models/Message';
import Company from '@/models/Company';
import mongoose, { isValidObjectId } from 'mongoose';
import {
  resolveCompanyAccess, eventVisibilityFilter, canSeeEvent, canManageEvent,
  getCompanyName, getCompaniesByIds, asObjectId, isStaff, isCorporate, sameCompany,
} from '@/lib/company';
import { partnerVisibilityFilter, myNgosFilter } from '@/lib/ngo';
import { slugify, loginSlug, employeeLogin } from '@/lib/loginName';
import { normalizeEmail, isValidEmail, EMAIL_COLLATION } from '@/lib/email';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
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
          companyId: user.companyId ? String(user.companyId) : null,
          companyName: await getCompanyName(user.companyId),
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
    const companyId = formData.get('companyId');

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
      userData.ngoName = name; // an NGO's organisation name is its display name
    }
    
    if (role === 'org_spoc' || role === 'org_member') {
      if (!companyId || !isValidObjectId(companyId)) {
        return { success: false, message: 'Choose the company this person belongs to' };
      }
      const company = await Company.findOne({ _id: companyId, status: 'active' }).select('_id').lean();
      if (!company) return { success: false, message: 'That company does not exist or is archived' };
      userData.companyId = company._id;
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
        select: 'title createdBy companyId',
        populate: { path: 'createdBy', select: 'name companyId' }
      })
      .select('-password').lean();

    const companies = await getCompaniesByIds([
      ...users.map((u) => u.companyId),
      ...users.flatMap((u) => (u.eventRegistrations || []).flatMap((r) => [r.eventId?.companyId, r.eventId?.createdBy?.companyId])),
    ]);
    const companyName = (id) => (id ? companies.get(String(id))?.name ?? null : null);

    return {
      success: true,
      users: users.map(user => ({
        _id: user._id.toString(),
        username: user.username,
        role: user.role,
        ngoId: user.ngoId,
        companyId: user.companyId ? String(user.companyId) : null,
        companyName: companyName(user.companyId),
        ngoName: user.ngoName || '',
        employerName: user.employerName || '',
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
          organizerName: companyName(reg.eventId?.companyId) || companyName(reg.eventId?.createdBy?.companyId) || reg.eventId?.createdBy?.name || 'Unknown',
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

    // Admin: all events. SPOC: every event of their company. Others: events they created.
    let eventQuery = { createdBy: currentUser._id };
    if (currentUser.role === 'admin') eventQuery = {};
    else if (currentUser.role === 'org_spoc' && currentUser.companyId) eventQuery = { companyId: currentUser.companyId };
    const userEvents = await Event.find(eventQuery).select('_id title').lean();
    const eventIds = userEvents.map(e => e._id);

    // Find all users who have at least one pending registration for these events
    const users = await User.find({
      'eventRegistrations.status': 'pending',
      'eventRegistrations.eventId': { $in: eventIds }
    }).populate('eventRegistrations.eventId', 'title').lean();
    const companies = await getCompaniesByIds(users.map((u) => u.companyId));

    // Flatten and format the response: one entry per pending registration
    const pendingRegistrations = [];
    users.forEach(user => {
      user.eventRegistrations.forEach(reg => {
        if (reg.status === 'pending' && reg.eventId && eventIds.some(id => id.toString() === reg.eventId._id.toString())) {
          pendingRegistrations.push({
            _id: user._id.toString(),
            name: user.name,
            username: user.username,
            role: user.role,
            companyName: companies.get(String(user.companyId))?.name || '',
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

    // A card must not keep pointing at a deleted login, or no new login could ever be generated for it.
    await NGOPartner.updateMany({ loginUserId: userToDelete._id }, { $set: { loginUserId: null } });
    
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
    const durationHours = formData.get('durationHours') ? parseFloat(formData.get('durationHours')) : 2;

    if (!title || !description || !date || !location) {
      return { success: false, message: 'All required fields must be filled' };
    }

    // A SPOC's events are company-internal. Without a company they would become public, so refuse.
    if (user.role === 'org_spoc' && !user.companyId) {
      return { success: false, message: 'Your account is not linked to a company' };
    }
    
    const event = await Event.create({
      title,
      description,
      date: new Date(date),
      location,
      registrationLink: '',
      capacity: capacity ? parseInt(capacity) : null,
      durationHours,
      imageUrl: imageUrl || '',
      createdBy: user._id,
      createdByRole: user.role,
      companyId: user.role === 'org_spoc' ? user.companyId : null,
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
    
    Object.assign(filter, eventVisibilityFilter(currentUser));

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
    Object.assign(filter, eventVisibilityFilter(currentUser));

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
        companyId: event.companyId ? String(event.companyId) : null,
        // Any SPOC or employee of the hosting company, not only the creator.
        isOwnCompanyEvent: isCorporate(currentUser) && !!event.companyId && sameCompany(event.companyId, currentUser.companyId),
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
    if (!isValidObjectId(id)) return { success: false, message: 'Event not found' };
    await connectDB();
    
    const event = await Event.findById(id).populate('createdBy', 'name role').lean();
    
    if (!event) {
      return { success: false, message: 'Event not found' };
    }

    const currentUser = await getCurrentUser();
    
    if (!canSeeEvent(currentUser, event)) {
      return {
        success: false,
        message: currentUser ? 'You do not have permission to view this event' : 'You must be logged in to view this private event',
      };
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
        companyId: event.companyId ? String(event.companyId) : null,
        companyName: await getCompanyName(event.companyId),
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
    
    if (!isValidObjectId(id)) return { success: false, message: 'Event not found' };
    await connectDB();
    
    const user = await getCurrentUser();
    const event = await Event.findById(id);
    
    if (!event) {
      return { success: false, message: 'Event not found' };
    }
    
    // Admins, the creator, or any SPOC of the event's company
    if (!canManageEvent(user, event)) {
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
    
    if (!isValidObjectId(id)) return { success: false, message: 'Event not found' };
    await connectDB();
    
    const user = await getCurrentUser();
    const event = await Event.findById(id);
    
    if (!event) {
      return { success: false, message: 'Event not found' };
    }
    
    // Admins, the creator, or any SPOC of the event's company
    if (!canManageEvent(user, event)) {
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
    const ngoName = (formData.get('ngoName') || '').trim();
    const employerName = (formData.get('employerName') || '').trim();
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

    // Public signup is for volunteers and NGOs. Admins register SPOCs and
    // employees against a Company; SPOCs generate their team's logins.
    if (!['volunteer', 'ngo'].includes(role)) {
      return { success: false, message: 'Invalid role selected' };
    }

    if (role === 'ngo' && !ngoName) {
      return { success: false, message: 'NGO name is required' };
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
      userData.ngoName = ngoName;
      userData.name = ngoName; // an NGO's display name is its organisation
    } else {
      userData.employerName = employerName;
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

const NGO_STAFF_ONLY = 'Only admins and employees can manage NGO partners';
const NGO_NOT_FOUND = { success: false, message: 'NGO partner not found' };
const ACTIVE_COMPANIES_ONLY = { success: false, message: 'Choose active companies only' };
const MAX_NGO_IMPORT_ROWS = 500;

// A client-sent id must be a string: isValidObjectId alone also accepts numbers and buffers.
const isIdString = (value) => typeof value === 'string' && isValidObjectId(value);

// Every partner-management action is for admins and employees only.
async function requireNgoStaff() {
  await connectDB();
  const caller = await getCurrentUser();
  if (!caller) return { error: { success: false, message: 'Not authenticated' } };
  if (!isStaff(caller)) return { error: { success: false, message: NGO_STAFF_ONLY } };
  return { caller };
}

// Reads the `companyIds` form value: a JSON array of company ids. Missing or
// empty means no companies (a public partner). Every id must be a valid id of
// an active company, except ids in `alreadyOnCard` (an archived company stays
// on a card that already has it, but is never added to another).
// Returns { ids } (unique, lowercase) or { error }.
async function readActiveCompanyIds(raw, alreadyOnCard = []) {
  let requested = [];
  if (raw != null && raw !== '') {
    if (typeof raw !== 'string') return { error: ACTIVE_COMPANIES_ONLY };
    try {
      requested = JSON.parse(raw);
    } catch {
      return { error: ACTIVE_COMPANIES_ONLY };
    }
    if (!Array.isArray(requested) || !requested.every(isIdString)) return { error: ACTIVE_COMPANIES_ONLY };
  }
  const ids = [...new Set(requested.map((id) => id.toLowerCase()))];
  const kept = new Set(alreadyOnCard.map(String));
  const added = ids.filter((id) => !kept.has(id));
  if (added.length > 0) {
    const active = await Company.countDocuments({ _id: { $in: added }, status: 'active' });
    if (active !== added.length) return { error: ACTIVE_COMPANIES_ONLY };
  }
  return { ids };
}

// The card shape the pages use. Staff see every company on a card and the
// username of its login. A company user sees only their own company on a card,
// so they cannot learn which other companies share an NGO.
async function presentPartners(partners, caller) {
  const staff = isStaff(caller);
  const ownCompany = isCorporate(caller) ? String(caller.companyId) : null;
  const shownIds = (p) => (p.companyIds || []).map(String).filter((id) => staff || id === ownCompany);
  const companies = await getCompaniesByIds(partners.flatMap(shownIds));

  const usernames = new Map();
  if (staff) {
    const loginIds = partners.map((p) => p.loginUserId).filter(Boolean);
    if (loginIds.length > 0) {
      const logins = await User.find({ _id: { $in: loginIds } }).select('username').lean();
      for (const login of logins) usernames.set(String(login._id), login.username);
    }
  }

  return partners.map((p) => {
    const companyIds = shownIds(p).filter((id) => companies.has(id));
    const item = {
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
      companyIds,
      companyNames: companyIds.map((id) => companies.get(id).name),
    };
    if (staff) item.loginUsername = p.loginUserId ? usernames.get(String(p.loginUserId)) ?? null : null;
    return item;
  });
}

// Public cards for everyone; company cards only to staff and that company.
export async function getAllNGOPartners() {
  try {
    await connectDB();
    const caller = await getCurrentUser();
    const partners = await NGOPartner.find(partnerVisibilityFilter(caller)).sort({ createdAt: -1, _id: -1 }).lean();
    return { success: true, partners: await presentPartners(partners, caller) };
  } catch (error) {
    console.error('Error fetching NGO partners:', error);
    return { success: false, message: 'Could not load NGO partners. Please try again.' };
  }
}

// A company's own NGOs, for its SPOCs and employees, with how many upcoming
// upcoming events (not cancelled or completed) each NGO's login has created for that company.
export async function getMyNGOs() {
  try {
    await connectDB();
    const caller = await getCurrentUser();
    if (!caller) return { success: false, message: 'Not authenticated' };
    if (!isCorporate(caller)) return { success: false, message: 'Not authorized' };

    const partners = await NGOPartner.find(myNgosFilter(caller)).sort({ createdAt: -1, _id: -1 }).lean();
    const items = await presentPartners(partners, caller);

    const upcoming = new Map();
    const loginIds = partners.map((p) => p.loginUserId).filter(Boolean);
    if (loginIds.length > 0) {
      const counts = await Event.aggregate([
        { $match: { createdBy: { $in: loginIds }, companyId: asObjectId(caller.companyId), date: { $gte: new Date() }, status: { $nin: ['cancelled', 'completed'] } } },
        { $group: { _id: '$createdBy', count: { $sum: 1 } } },
      ]);
      for (const c of counts) upcoming.set(String(c._id), c.count);
    }

    return {
      success: true,
      partners: items.map((item, i) => ({ ...item, upcomingEvents: upcoming.get(String(partners[i].loginUserId)) || 0 })),
    };
  } catch (error) {
    console.error('Error fetching company NGOs:', error);
    return { success: false, message: 'Could not load your NGOs. Please try again.' };
  }
}

export async function createNGOPartner(formData) {
  try {
    const { caller, error } = await requireNgoStaff();
    if (error) return error;

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

    const companies = await readActiveCompanyIds(formData.get('companyIds'));
    if (companies.error) return companies.error;

    const partner = await NGOPartner.create({
      name, description, logoUrl, focusAreas, programs, impact, registeredOffice, location, website, companyIds: companies.ids,
    });

    revalidatePath('/ngo-partners');
    revalidatePath('/admin/ngo-partners');
    revalidatePath('/dashboard/my-ngos');

    const [item] = await presentPartners([partner.toObject()], caller);
    return { success: true, partner: item };
  } catch (error) {
    console.error('Error creating NGO partner:', error);
    return { success: false, message: 'Could not add the NGO partner. Please try again.' };
  }
}

export async function updateNGOPartner(id, formData) {
  try {
    const { caller, error } = await requireNgoStaff();
    if (error) return error;
    if (!isIdString(id)) return NGO_NOT_FOUND;

    const existing = await NGOPartner.findById(id).select('companyIds').lean();
    if (!existing) return NGO_NOT_FOUND;

    const name = formData.get('name')?.trim();
    const description = formData.get('description')?.trim();
    const focusAreas = formData.get('focusAreas')?.trim() || '';
    const programsRaw = formData.get('programs')?.trim() || '';
    const programs = programsRaw ? programsRaw.split('\n').map((l) => l.trim()).filter(Boolean) : [];
    const impact = formData.get('impact')?.trim() || '';
    const registeredOffice = formData.get('registeredOffice')?.trim() || '';
    const location = formData.get('location')?.trim() || '';
    const website = formData.get('website')?.trim() || '';
    const logoUrl = formData.get('logoUrl')?.trim(); // Can be undefined if no new logo uploaded

    if (!name || !description) {
      return { success: false, message: 'Name and description are required' };
    }

    const updateData = { name, description, focusAreas, programs, impact, registeredOffice, location, website };
    if (logoUrl) {
      updateData.logoUrl = logoUrl;
    }
    // Only a real list changes the companies ("[]" included). An absent, empty or blank field leaves them as they are.
    const rawCompanyIds = formData.get('companyIds');
    const sent = rawCompanyIds !== null && !(typeof rawCompanyIds === 'string' && rawCompanyIds.trim() === '');
    if (sent) {
      const companies = await readActiveCompanyIds(rawCompanyIds, existing.companyIds || []);
      if (companies.error) return companies.error;
      updateData.companyIds = companies.ids;
    }

    const partner = await NGOPartner.findByIdAndUpdate(id, updateData, { new: true });
    if (!partner) return NGO_NOT_FOUND;

    revalidatePath('/ngo-partners');
    revalidatePath('/admin/ngo-partners');
    revalidatePath('/dashboard/my-ngos');

    const [item] = await presentPartners([partner.toObject()], caller);
    return { success: true, partner: item };
  } catch (error) {
    console.error('Error updating NGO partner:', error);
    return { success: false, message: 'Could not update the NGO partner. Please try again.' };
  }
}

// Creates one card per valid row, all for the same companies (none = public).
// Returns how many were created and which rows were skipped and why.
export async function importNGOPartners(rows, companyIdsJson) {
  try {
    const { error } = await requireNgoStaff();
    if (error) return error;
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > MAX_NGO_IMPORT_ROWS) {
      return { success: false, message: `Import between 1 and ${MAX_NGO_IMPORT_ROWS} rows at a time` };
    }
    const companies = await readActiveCompanyIds(companyIdsJson);
    if (companies.error) return companies.error;

    const cell = (value) => (typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '');
    const docs = [];
    const rowNumbers = [];
    const skipped = [];
    rows.forEach((row, index) => {
      const rowNumber = index + 1;
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        skipped.push({ row: rowNumber, reason: 'Not a valid row' });
        return;
      }
      const name = cell(row.name);
      const description = cell(row.description);
      if (!name || !description) {
        const missing = [!name && 'name', !description && 'description'].filter(Boolean).join(' and ');
        skipped.push({ row: rowNumber, reason: `Missing ${missing}` });
        return;
      }
      docs.push({
        _id: new mongoose.Types.ObjectId(),
        name,
        description,
        focusAreas: cell(row.focusAreas),
        programs: cell(row.programs).split(/[\n;]/).map((l) => l.trim()).filter(Boolean),
        impact: cell(row.impact),
        registeredOffice: cell(row.registeredOffice),
        location: cell(row.location),
        website: cell(row.website),
        companyIds: companies.ids,
      });
      rowNumbers.push(rowNumber);
    });

    let created = 0;
    if (docs.length > 0) {
      try {
        await NGOPartner.insertMany(docs, { ordered: false });
      } catch (insertError) {
        // Some rows may still have been saved; count them below.
        console.error('Some NGO partners were not imported:', insertError);
      }
      const saved = await NGOPartner.find({ _id: { $in: docs.map((d) => d._id) } }).select('_id').lean();
      const savedIds = new Set(saved.map((p) => String(p._id)));
      created = savedIds.size;
      docs.forEach((d, i) => {
        if (!savedIds.has(String(d._id))) skipped.push({ row: rowNumbers[i], reason: 'Could not be saved' });
      });
      skipped.sort((a, b) => a.row - b.row);
      if (created === 0) {
        return { success: false, message: 'Could not import the NGOs. Please try again.', created: 0, skipped };
      }
    }

    revalidatePath('/ngo-partners');
    revalidatePath('/admin/ngo-partners');
    revalidatePath('/dashboard/my-ngos');
    return { success: true, created, skipped };
  } catch (error) {
    console.error('Error importing NGO partners:', error);
    return { success: false, message: 'Could not import the NGOs. Please try again.' };
  }
}

// "Green Earth" -> "green-earth": at most 20 characters, never ending in a hyphen.
const ngoLoginSlug = (name) =>
  slugify(name).replace(/-{2,}/g, '-').replace(/^-+/, '').slice(0, 20).replace(/-+$/, '') || 'ngo';

// Creates the one NGO login for a card and returns its credentials, once.
export async function generateNGOLogin(partnerId) {
  try {
    const { error } = await requireNgoStaff();
    if (error) return error;
    if (!isIdString(partnerId)) return NGO_NOT_FOUND;

    const partner = await NGOPartner.findById(partnerId).select('name loginUserId').lean();
    if (!partner) return NGO_NOT_FOUND;
    if (partner.loginUserId) return { success: false, message: 'This NGO already has a login' };

    const password = crypto.randomBytes(8).toString('base64url').slice(0, 10);
    const slug = ngoLoginSlug(partner.name);
    let user = null;
    for (let attempt = 0; attempt < 5 && !user; attempt++) {
      const username = `${slug}-${String(crypto.randomInt(0, 10000)).padStart(4, '0')}`;
      const ngoId = `NGO-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      if (await User.exists({ $or: [{ username }, { ngoId }] })) continue;
      try {
        user = await User.create({
          username,
          password, // hashed by the User model before saving
          name: partner.name,
          ngoName: partner.name,
          role: 'ngo',
          status: 'approved',
          ngoId,
          ngoPartnerId: partner._id,
        });
      } catch (createError) {
        if (createError?.code !== 11000) throw createError; // taken between the check and the save: try again
      }
    }
    if (!user) return { success: false, message: 'Could not generate a login. Please try again.' };

    // Link only if the card still has no login, so two simultaneous requests
    // cannot both succeed. The loser removes the login it just created.
    let linked;
    try {
      linked = await NGOPartner.updateOne({ _id: partner._id, loginUserId: null }, { $set: { loginUserId: user._id } });
    } catch (linkError) {
      await User.deleteOne({ _id: user._id }).catch((cleanupError) => console.error('Could not remove an unlinked NGO login:', cleanupError));
      throw linkError;
    }
    if (linked.modifiedCount !== 1) {
      await User.deleteOne({ _id: user._id });
      return { success: false, message: 'Could not generate a login. Please try again.' };
    }

    revalidatePath('/admin/ngo-partners');
    return { success: true, username: user.username, password };
  } catch (error) {
    console.error('Error generating NGO login:', error);
    return { success: false, message: 'Could not generate a login. Please try again.' };
  }
}

export async function deleteNGOPartner(id) {
  try {
    const { error } = await requireNgoStaff();
    if (error) return error;
    if (!isIdString(id)) return NGO_NOT_FOUND;

    const partner = await NGOPartner.findById(id).select('loginUserId').lean();
    if (!partner) return NGO_NOT_FOUND;

    // Reject the card's login first, so a login can never outlive its card. Only NGO accounts are touched.
    // Their ngoPartnerId keeps pointing at the deleted card: a login whose card is missing may create nothing,
    // whereas one with no card at all could create public events.
    const linked = [{ ngoPartnerId: partner._id }];
    if (partner.loginUserId) linked.push({ _id: partner.loginUserId });
    await User.updateMany({ role: 'ngo', $or: linked }, { $set: { status: 'rejected' } });
    await NGOPartner.deleteOne({ _id: partner._id });

    revalidatePath('/ngo-partners');
    revalidatePath('/admin/ngo-partners');
    revalidatePath('/dashboard/my-ngos');

    return { success: true };
  } catch (error) {
    console.error('Error deleting NGO partner:', error);
    return { success: false, message: 'Could not delete the NGO partner. Please try again.' };
  }
}

// ─────────────────────────────────────────────────────────────
// CORPORATE TEAM MANAGEMENT
// ─────────────────────────────────────────────────────────────

// Which active company new team logins go into: a SPOC's own; an admin must name one.
async function teamCompanyFor(caller, requestedCompanyId) {
  const id = caller.role === 'org_spoc' ? caller.companyId : requestedCompanyId;
  if (!id || !isValidObjectId(String(id))) return null;
  return Company.findOne({ _id: id, status: 'active' }).select('name').lean();
}


// Next free <slug>-<n> index across every user, not only this company's:
// two companies can share a slug ("Acme" and "ACME!").
async function nextLoginIndex(slug) {
  // loginSlug only yields [a-z0-9-], so the slug needs no regex escaping.
  // At most 9 digits, so the index stays a safe integer: employee-ID logins
  // (`<slug>-12345678901234567`) must not push generated ones into exponent form.
  const pattern = new RegExp(`^${slug}-(\\d{1,9})$`);
  const users = await User.find({ username: pattern }).select('username').lean();
  return users.reduce((max, u) => Math.max(max, Number(pattern.exec(u.username)?.[1]) || 0), 0) + 1;
}

// insertMany with ordered:false; returns whether every error was a duplicate key.
async function insertEach(docs) {
  try {
    await User.insertMany(docs, { ordered: false });
    return true;
  } catch (error) {
    console.error('Some accounts were not created:', error);
    const errs = error?.writeErrors || [];
    return error?.code === 11000 || (errs.length > 0 && errs.every((e) => (e.code ?? e.err?.code) === 11000));
  }
}

const savedIdsOf = async (docs) =>
  new Set((await User.find({ _id: { $in: docs.map((d) => d._id) } }).select('_id').lean()).map((u) => String(u._id)));

// Inserts every account it can. Returns the credentials of the rows actually
// created plus a generic message; never the driver's error text or other
// companies' usernames. A doc whose email is taken between the caller's check and
// the insert is saved again without it; `onEmailDropped(i)` hears about each one.
// `note` is appended to the message (and sets one when nothing failed).
async function insertAccounts(docs, credentials, { note = () => '', onEmailDropped = () => {} } = {}) {
  for (const d of docs) d._id = new mongoose.Types.ObjectId();
  let duplicate = await insertEach(docs);
  let savedIds = await savedIdsOf(docs);
  const retry = docs.filter((d) => !savedIds.has(String(d._id)) && d.email);
  if (retry.length) {
    const withoutEmail = retry.map((d) => { const copy = { ...d }; delete copy.email; return copy; });
    duplicate = (await insertEach(withoutEmail)) && duplicate;
    savedIds = await savedIdsOf(docs);
    docs.forEach((d, i) => { if (retry.includes(d) && savedIds.has(String(d._id))) onEmailDropped(i); });
  }
  const savedAt = docs.map((d) => savedIds.has(String(d._id)));
  const created = credentials.filter((_, i) => savedAt[i]);
  const failed = docs.length - created.length;
  const extra = note(savedAt);
  if (failed === 0) {
    return { success: true, created: created.length, failed: 0, credentials: created, ...(extra ? { message: extra } : {}) };
  }
  const why = duplicate
    ? 'The others were not created because their usernames are already taken.'
    : 'The others could not be created. Please try again.';
  return {
    success: created.length > 0,
    created: created.length,
    failed,
    credentials: created,
    message: [`Created ${created.length} of ${docs.length} accounts. ${why}`, extra].filter(Boolean).join(' '),
  };
}

/**
 * Generate N pre-approved org_member accounts for a company.
 * Can be called by a SPOC (for their own company) or an Admin (for any active company).
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

    const company = await teamCompanyFor(caller, formData.get('companyId'));
    const count   = parseInt(formData.get('count'));

    if (!company || !count || count < 1 || count > 500) {
      return { success: false, message: 'Choose a company and a count (1–500)' };
    }
    const orgName = company.name;
    const orgSlug = loginSlug(orgName);
    const startIndex = await nextLoginIndex(orgSlug);

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
        companyId: company._id,
        status: 'approved',
        spocId: caller.role === 'org_spoc' ? caller._id : null,
        requiresNameUpdate: true,
      });
      plainCredentials.push({ username, password, name: `${orgName} Volunteer ${idx}` });
    }

    const result = await insertAccounts(usersToCreate, plainCredentials);
    revalidatePath('/admin/corporate');
    revalidatePath('/dashboard/team');
    return result;
  } catch (error) {
    console.error('Error generating team logins:', error);
    return { success: false, message: 'Could not generate team logins. Please try again.' };
  }
}

const cellText = (v) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '');

/**
 * Bulk create org_member accounts from parsed Excel rows.
 * Each row: { name, employeeId (optional), username (optional), email (optional) }
 * Username: <companySlug>-<employeeId>, else the Email/Username cell, else generated.
 * A username that is taken (by another account or an earlier row) fails that row only.
 */
export async function bulkCreateFromExcel(rows, companyId = null) {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    const caller = await getCurrentUser();
    if (caller.role !== 'admin' && caller.role !== 'org_spoc') {
      return { success: false, message: 'Only Admin or SPOC can bulk create accounts' };
    }

    await connectDB();

    const company = await teamCompanyFor(caller, companyId);
    if (!Array.isArray(rows) || !rows.length || !company) {
      return { success: false, message: 'Rows and a company are required' };
    }
    const orgName = company.name;
    const orgSlug = loginSlug(orgName);
    const salt    = await bcrypt.genSalt(10);
    const plainCredentials = [];
    const usersToCreate    = [];

    // Emails never block an account: an invalid one is ignored, and one already
    // used (by another account, in any case, or by an earlier row) is dropped.
    const emails = [];
    const emailIssue = []; // per row: 'invalid' | 'taken'
    const seen = new Set();
    for (let i = 0; i < rows.length; i++) {
      const email = normalizeEmail(cellText(rows[i]?.email));
      if (!email) continue;
      if (!isValidEmail(email)) emailIssue[i] = 'invalid';
      else if (seen.has(email)) emailIssue[i] = 'taken';
      else { seen.add(email); emails[i] = email; }
    }
    if (seen.size) {
      const used = await User.distinct('email', { email: { $in: [...seen] } }).collation(EMAIL_COLLATION);
      const usedSet = new Set(used.map((e) => String(e).toLowerCase()));
      emails.forEach((email, i) => {
        if (usedSet.has(email)) { emails[i] = undefined; emailIssue[i] = 'taken'; }
      });
    }

    for (let i = 0; i < rows.length; i++) {
      const row      = rows[i] || {};
      const username = employeeLogin(orgSlug, row.employeeId)
        || cellText(row.username)
        || `${orgSlug}-emp-${Date.now()}-${i}`;
      const name     = cellText(row.name) || `${orgName} Volunteer ${i + 1}`;
      const password = Math.random().toString(36).slice(2, 10);
      const hashed   = await bcrypt.hash(password, salt);

      usersToCreate.push({
        username,
        password: hashed,
        name,
        role: 'org_member',
        companyId: company._id,
        status: 'approved',
        spocId: caller.role === 'org_spoc' ? caller._id : null,
        ...(emails[i] ? { email: emails[i] } : {}),
      });
      plainCredentials.push({ username, password, name });
    }

    // Reported only for rows that were created; counts, never the addresses.
    const emailNote = (savedAt) => {
      const count = (kind) => emailIssue.filter((k, i) => k === kind && savedAt[i]).length;
      const taken = count('taken');
      const invalid = count('invalid');
      return [
        taken && `${taken} ${taken === 1 ? 'email was' : 'emails were'} not saved because another account or an earlier row already uses ${taken === 1 ? 'it' : 'them'}.`,
        invalid && `${invalid} ${invalid === 1 ? 'email was ignored because it is not a valid address' : 'emails were ignored because they are not valid addresses'}.`,
      ].filter(Boolean).join(' ');
    };
    const result = await insertAccounts(usersToCreate, plainCredentials, {
      note: emailNote,
      onEmailDropped: (i) => { emailIssue[i] = 'taken'; },
    });
    revalidatePath('/admin/corporate');
    revalidatePath('/dashboard/team');
    return result;
  } catch (error) {
    console.error('Error bulk creating accounts:', error);
    return { success: false, message: 'Could not create the accounts. Please try again.' };
  }
}

/**
 * Get all org_member users for a company. SPOCs see their own company's;
 * admins name one.
 */
export async function getOrgMembers(companyId) {
  try {
    await connectDB();
    const caller = await getCurrentUser();
    if (caller && caller.role !== 'admin' && caller.role !== 'org_spoc') {
      return { success: false, message: 'Not authorized' };
    }
    if (companyId && !isValidObjectId(String(companyId))) {
      return { success: false, message: 'Invalid company' };
    }
    const access = resolveCompanyAccess(caller, companyId);
    if (access.error) return { success: false, message: access.error };
    if (!access.companyId) return { success: true, members: [] };

    const members = await User.find({ companyId: access.companyId, role: 'org_member' })
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

    // Validate the whole payload before any database call.
    const isIdValue = (v) => (typeof v === 'string' || v instanceof mongoose.Types.ObjectId) && isValidObjectId(v);
    if (!isValidObjectId(String(eventId)) || !Array.isArray(attendanceList)
        || attendanceList.some((a) => !a || !isIdValue(a.userId))) {
      return { success: false, message: 'Invalid attendance data' };
    }
    if (new Set(attendanceList.map((a) => String(a.userId))).size !== attendanceList.length) {
      return { success: false, message: 'Each person can appear only once' };
    }
    const validHours = (h) => typeof h === 'number' && Number.isFinite(h) && h >= 0 && h <= 24;
    if (attendanceList.some((a) => !validHours(a.hoursContributed ?? 0))) {
      return { success: false, message: 'Hours must be a number from 0 to 24' };
    }
    // `attended` drives the hours arithmetic, so it must be a real boolean: the
    // string "false" is truthy and would credit hours the record says were not earned.
    const ATTENDED = new Map([[true, true], [false, false], ['true', true], ['false', false]]);
    if (attendanceList.some((a) => !ATTENDED.has(a.attended))) {
      return { success: false, message: 'Attended must be true or false' };
    }
    const entries = attendanceList.map((a) => ({ ...a, attended: ATTENDED.get(a.attended) }));

    await connectDB();

    const now = new Date();

    // Fetch existing records first to correctly calculate hours diff
    const userIds = attendanceList.map(a => String(a.userId));

    const event = await Event.findById(eventId).select('companyId').lean();
    // An event this caller may not see answers exactly like a missing one.
    if (!event || (caller.role === 'org_spoc' && !canSeeEvent(caller, event))) {
      return { success: false, message: 'Event not found' };
    }
    const people = await User.find({ _id: { $in: userIds } }).select('companyId').lean();
    const companyOf = new Map(people.map((p) => [String(p._id), p.companyId || null]));
    if (userIds.some((id) => !companyOf.has(id))) {
      return { success: false, message: 'Some of these people no longer exist' };
    }

    // SPOCs may only mark their own company's employees.
    if (caller.role === 'org_spoc') {
      const outsiders = userIds.filter((id) => String(companyOf.get(id)) !== String(caller.companyId));
      if (!caller.companyId || outsiders.length > 0) {
        return { success: false, message: 'You can only mark attendance for your own company' };
      }
    }
    const existingRecords = await Attendance.find({ eventId, userId: { $in: userIds } }).lean();
    const existingMap = {};
    existingRecords.forEach(r => existingMap[r.userId.toString()] = r);

    const ops = [];
    const userIncOps = [];

    for (const entry of entries) {
      const existing = existingMap[String(entry.userId)];
      
      // Calculate diff in hours to credit/deduct
      const oldHours = existing?.attended ? (existing.hoursContributed || 0) : 0;
      const newHours = entry.attended ? (entry.hoursContributed || 0) : 0;
      const diff = newHours - oldHours;
      
      if (diff !== 0) {
        userIncOps.push({ userId: String(entry.userId), diff });
      }

      ops.push({
        updateOne: {
          filter: { eventId, userId: entry.userId },
          update: {
            $set: {
              companyId: companyOf.get(String(entry.userId)) ?? null,
              attended: entry.attended,
              hoursContributed: entry.hoursContributed ?? 0,
              feedbackScore: entry.feedbackScore || null,
              markedAt: now,
              markedBy: caller._id,
            }
          },
          upsert: true,
        }
      });
    }

    if (ops.length > 0) {
      await Attendance.bulkWrite(ops);
    }

    // Update cached totalVolunteerHours for each user
    for (const { userId, diff } of userIncOps) {
      await User.findByIdAndUpdate(userId, {
        $inc: { totalVolunteerHours: diff }
      });
    }

    revalidatePath('/', 'layout');

    return { success: true };
  } catch (error) {
    console.error('Error marking attendance:', error);
    return { success: false, message: 'Could not save attendance. Please try again.' };
  }
}

/**
 * Get attendance list for a specific event. SPOCs see their own company's
 * records; admins see everyone's, or one company's when they name it.
 */
export async function getEventAttendance(eventId, companyId) {
  try {
    await connectDB();
    const caller = await getCurrentUser();
    if (caller && caller.role !== 'admin' && caller.role !== 'org_spoc') {
      return { success: false, message: 'Not authorized' };
    }
    if (!isValidObjectId(String(eventId)) || (companyId && !isValidObjectId(String(companyId)))) {
      return { success: false, message: 'Event not found' };
    }
    const access = resolveCompanyAccess(caller, companyId);
    if (access.error) return { success: false, message: access.error };

    const event = await Event.findById(eventId).select('companyId').lean();
    if (!event || !canSeeEvent(caller, event)) return { success: false, message: 'Event not found' };

    const filter = { eventId };
    if (access.companyId) filter.companyId = access.companyId;

    const records = await Attendance.find(filter)
      .populate('userId', 'name username')
      .lean();

    return {
      success: true,
      records: records.filter(r => r.userId).map(r => ({
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
export async function getOrgStats(companyId, targetYear) {
  try {
    await connectDB();
    const access = resolveCompanyAccess(await getCurrentUser(), companyId);
    if (access.error) return { success: false, message: access.error };
    if (!access.companyId) return { success: false, message: 'Company is required' };
    if (!isValidObjectId(access.companyId)) return { success: false, message: 'Company not found' };
    const company = asObjectId(access.companyId);

    const year = targetYear ? parseInt(targetYear, 10) : new Date().getFullYear();

    // Total members
    const totalVolunteers = await User.countDocuments({ companyId: company, role: 'org_member' });

    // Aggregate from Attendance (for all time or we could scope it to the year, but usually top-level stats are all-time)
    const agg = await Attendance.aggregate([
      { $match: { companyId: company, attended: true } },
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

    // Yearly and Quarterly participation
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const monthly = await Attendance.aggregate([
      { $match: { companyId: company, attended: true, markedAt: { $gte: startOfYear, $lte: endOfYear } } },
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

    // Ensure all 12 months are present for the chart
    const fullMonthly = Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1;
      const mData = monthly.find(m => m._id.month === monthNum);
      const d = new Date(year, i, 1);
      return {
        month: `${year}-${String(monthNum).padStart(2, '0')}`,
        label: d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short' }),
        count: mData ? mData.count : 0,
        hours: mData ? mData.hours : 0,
      };
    });

    // Quarterly aggregation
    const quarterlyMap = { Q1: { count: 0, hours: 0 }, Q2: { count: 0, hours: 0 }, Q3: { count: 0, hours: 0 }, Q4: { count: 0, hours: 0 } };
    
    monthly.forEach(m => {
      const q = Math.floor((m._id.month - 1) / 3) + 1;
      quarterlyMap[`Q${q}`].count += m.count;
      quarterlyMap[`Q${q}`].hours += m.hours;
    });

    const quarterly = Object.keys(quarterlyMap).map(q => ({
      quarter: q,
      count: quarterlyMap[q].count,
      hours: quarterlyMap[q].hours
    }));

    // Unique NGOs engaged (via events)
    const eventIds = stats.totalEvents || [];
    const eventsData = await Event.find({ _id: { $in: eventIds } })
      .select('title date location companyId createdBy').populate('createdBy', 'ngoId').lean();
    const ngoIds = [...new Set(eventsData.map(e => e.createdBy?.ngoId).filter(Boolean))];

    // Aggregate attendance per event for detail list
    const eventAttendanceDetails = await Attendance.aggregate([
      { $match: { companyId: company, attended: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: { path: '$user', preserveNullAndEmptyArrays: true }
      },
      {
        $group: {
          _id: '$eventId',
          hours: { $sum: '$hoursContributed' },
          attendees: { $sum: 1 },
          attendeeDetails: {
            $push: {
              name: '$user.name',
              username: '$user.username',
              hours: '$hoursContributed'
            }
          }
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
        attendeeDetails: detail.attendeeDetails,
        isCorporate: !!ev.companyId, // internal company event vs public
      };
    }).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date) || a._id.localeCompare(b._id));

    return {
      success: true,
      stats: {
        totalVolunteers,
        volunteerHours:         stats.totalHours || 0,
        eventsAttended:         (stats.totalEvents || []).length,
        ngosEngaged:            ngoIds.length,
        avgFeedback:            stats.avgFeedback ? Math.round(stats.avgFeedback * 10) / 10 : null,
        participationRate:      totalVolunteers > 0
          ? Math.round(((stats.attendanceCount || 0) / totalVolunteers) * 100)
          : 0,
      },
      monthly: fullMonthly,
      quarterly,
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
    if (caller?.role !== 'admin') return { success: false, message: 'Admin only' };

    await connectDB();

    const companies = await Company.find({ status: 'active' }).sort({ name: 1 }).lean();
    const ids = companies.map((c) => c._id);
    const [spocs, memberCounts, attendance] = await Promise.all([
      User.find({ role: 'org_spoc', companyId: { $in: ids } }).select('name companyId').lean(),
      User.aggregate([{ $match: { role: 'org_member', companyId: { $in: ids } } }, { $group: { _id: '$companyId', n: { $sum: 1 } } }]),
      Attendance.aggregate([
        { $match: { attended: true, companyId: { $in: ids } } },
        { $group: { _id: '$companyId', hours: { $sum: '$hoursContributed' }, events: { $addToSet: '$eventId' } } },
      ]),
    ]);
    const membersBy = new Map(memberCounts.map((m) => [String(m._id), m.n]));
    const attendanceBy = new Map(attendance.map((a) => [String(a._id), a]));

    const orgs = companies.map((c) => {
      const id = String(c._id);
      const a = attendanceBy.get(id) || {};
      return {
        companyId: id,
        name: c.name,
        spocNames: spocs.filter((s) => String(s.companyId) === id).map((s) => s.name),
        memberCount: membersBy.get(id) || 0,
        volunteerHours: a.hours || 0,
        eventsAttended: (a.events || []).length,
        joinedAt: c.createdAt ? c.createdAt.toISOString() : null,
      };
    });

    return { success: true, orgs };
  } catch (error) {
    console.error('Error getting all corporate stats:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Get comprehensive directory stats for all NGOs and SPOCs (used in Admin Directory page)
 */
export async function getDetailedDirectoryStats() {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    const caller = await getCurrentUser();
    if (caller?.role !== 'admin' && caller?.role !== 'employee') return { success: false, message: 'Admin/Employee only' };

    await connectDB();

    // 1. Get all SPOCs and calculate their stats
    const spocs = await User.find({ role: 'org_spoc' })
      .select('name username companyId status createdAt mobile').lean();
    const companies = await getCompaniesByIds(spocs.map((s) => s.companyId));

    const spocsWithStats = await Promise.all(spocs.map(async spoc => {
      // A SPOC with no company has no team and no company attendance. Matching on a
      // null companyId would pick up every individual, so skip the lookups.
      const members = spoc.companyId ? await User.find({
        companyId: spoc.companyId,
        role: 'org_member',
      }).select('name username').lean() : [];
      
      const memberCount = members.length;
      const memberNames = members.map(m => m.name);

      const agg = !spoc.companyId ? [] : await Attendance.aggregate([
        { $match: { companyId: spoc.companyId, attended: true } },
        {
          $lookup: {
            from: 'events',
            localField: 'eventId',
            foreignField: '_id',
            as: 'eventDetails'
          }
        },
        { $unwind: { path: '$eventDetails', preserveNullAndEmptyArrays: true } },
        { 
          $group: { 
            _id: null, 
            hours: { $sum: '$hoursContributed' }, 
            events: { $addToSet: '$eventId' },
            eventNames: { $addToSet: '$eventDetails.title' }
          } 
        }
      ]);
      const a = agg[0] || {};
      return {
        _id:             spoc._id.toString(),
        name:            spoc.name,
        email:           spoc.username,
        mobile:          spoc.mobile || '-',
        companyId:       spoc.companyId ? String(spoc.companyId) : null,
        companyName:     companies.get(String(spoc.companyId))?.name || '',
        status:          spoc.status,
        memberCount,
        memberNames,
        volunteerHours:  a.hours || 0,
        eventsAttended:  (a.events || []).length,
        eventNames:      (a.eventNames || []).filter(Boolean),
        joinedAt:        spoc.createdAt ? spoc.createdAt.toISOString() : null,
      };
    }));

    // 2. Get all NGOs and calculate their stats
    const ngos = await User.find({ role: 'ngo' })
      .select('name username ngoId status createdAt mobile').lean();

    const ngosWithStats = await Promise.all(ngos.map(async ngo => {
      const events = await Event.find({ createdBy: ngo._id }).select('title').lean();
      const eventNames = events.map(e => e.title);
      return {
        _id:          ngo._id.toString(),
        name:         ngo.name,
        email:        ngo.username,
        mobile:       ngo.mobile || '-',
        ngoId:        ngo.ngoId || '-',
        status:       ngo.status,
        eventsCreated: events.length,
        eventNames,
        joinedAt:     ngo.createdAt ? ngo.createdAt.toISOString() : null,
      };
    }));

    return { 
      success: true, 
      spocs: spocsWithStats,
      ngos: ngosWithStats 
    };
  } catch (error) {
    console.error('Error getting detailed directory stats:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Get detailed master attendance data for all corporate volunteers
 */
export async function exportDetailedAttendanceData(companyId = null, year = null, quarter = null) {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    const caller = await getCurrentUser();
    if (caller?.role !== 'admin' && caller?.role !== 'employee') return { success: false, message: 'Admin/Employee only' };

    await connectDB();

    const query = { attended: true };
    if (companyId) {
      // A filter that is not a real id must not widen into "everything".
      if (!isValidObjectId(String(companyId))) return { success: false, message: 'Company not found' };
      query.companyId = String(companyId);
    }

    let attendanceRecords = await Attendance.find(query)
      .populate('eventId', 'title date location')
      .populate('userId', 'name username email')
      .populate('companyId', 'name')
      .lean();

    if (year) {
      attendanceRecords = attendanceRecords.filter(record => {
        if (!record.eventId || !record.eventId.date) return false;
        const d = new Date(record.eventId.date);
        if (isNaN(d.getTime())) return false;
        if (d.getFullYear() !== parseInt(year)) return false;
        
        if (quarter && quarter !== 'All Year') {
          const m = d.getMonth() + 1; // 1-12
          if (quarter === 'Q1' && (m < 1 || m > 3)) return false;
          if (quarter === 'Q2' && (m < 4 || m > 6)) return false;
          if (quarter === 'Q3' && (m < 7 || m > 9)) return false;
          if (quarter === 'Q4' && (m < 10 || m > 12)) return false;
        }
        return true;
      });
    }

    const detailedData = attendanceRecords.map(record => ({
      companyName: record.companyId?.name || 'Individual',
      volunteerName: record.userId?.name || 'Unknown',
      volunteerUsername: record.userId?.username || 'Unknown',
      volunteerEmail: record.userId?.email || '',
      eventTitle: record.eventId?.title || 'Unknown Event',
      eventDate: record.eventId?.date ? new Date(record.eventId.date).toISOString() : '',
      eventLocation: record.eventId?.location || '',
      hoursContributed: record.hoursContributed || 0,
      feedbackScore: record.feedbackScore || '',
      feedbackText: record.feedbackText || '',
      markedAt: record.markedAt ? new Date(record.markedAt).toISOString() : ''
    }));

    return { success: true, data: detailedData };
  } catch (error) {
    console.error('Error exporting detailed attendance data:', error);
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

export async function updatePassword(currentPassword, newPassword) {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    await connectDB();
    const user = await User.findById(session.userId);
    if (!user) return { success: false, message: 'User not found' };

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return { success: false, message: 'Incorrect current password' };

    user.password = newPassword;
    await user.save();

    return { success: true };
  } catch (error) {
    console.error('Error updating password:', error);
    return { success: false, message: 'Could not update your password. Please try again.' };
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

    if (!isValidObjectId(String(eventId))) return { success: false, message: 'Event not found' };
    await connectDB();

    const event = await Event.findById(eventId).lean();
    if (!event || !canSeeEvent(caller, event)) return { success: false, message: 'Event not found' };

    const eventDate = new Date(event.date);
    if (eventDate > new Date()) {
      return { success: false, message: 'You can only log hours for past events' };
    }

    if (hours < 0 || hours > 24) {
      return { success: false, message: 'Please enter a valid number of hours (0-24)' };
    }

    const existing = await Attendance.findOne({ eventId, userId: caller._id });

    // UPSERT the hours and feedback, but do NOT override `attended` if it exists.
    // If it doesn't exist, it defaults to attended: false by omitting it (handled by mongoose or just left out).
    await Attendance.findOneAndUpdate(
      { eventId, userId: caller._id },
      {
        $set: {
          hoursContributed: hours,
          feedbackScore: feedbackScore || null,
          companyId: caller.companyId ?? null,
        }
      },
      { new: true, upsert: true }
    );

    // Update cached total volunteer hours ONLY IF they are marked as attended.
    // If they log hours BEFORE SPOC marks attendance, totalVolunteerHours will be updated LATER by the SPOC.
    // If they are ALREADY marked as attended, we update their totalVolunteerHours by the difference.
    if (existing?.attended) {
      const prevHours = existing.hoursContributed || 0;
      const diff = hours - prevHours;
      if (diff !== 0) {
        await User.findByIdAndUpdate(caller._id, { $inc: { totalVolunteerHours: diff } });
      }
    }

    revalidatePath('/', 'layout');
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
    if (!caller || !['org_member', 'volunteer'].includes(caller.role)) return { success: false, message: 'Volunteers and Org Members only' };

    await connectDB();

    // Get only events the user has registered for (participated in)
    const registeredEventIds = (caller.eventRegistrations || []).map(r => r.eventId);
    const allEvents = await Event.find({ _id: { $in: registeredEventIds } })
      .select('title date location description status durationHours companyId')
      .sort({ date: -1 })
      .lean();
    const impactCompanies = await getCompaniesByIds([caller.companyId, ...allEvents.map((e) => e.companyId)]);

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
        status: ev.status,
        lifecycle,
        isPast: lifecycle === 'ended',
        myRegistrationStatus: registration ? registration.status : null,
        myHours: rec?.hoursContributed || 0,
        myFeedback: rec?.feedbackScore || null,
        attended: rec?.attended || false,
        companyName: impactCompanies.get(String(ev.companyId))?.name || null,
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
        companyName: impactCompanies.get(String(caller.companyId))?.name || null,
        companyLogo: impactCompanies.get(String(caller.companyId))?.logoUrl || null,
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
    
    if (!isValidObjectId(eventId)) return { success: false, message: 'Event not found' };

    const event = await Event.findById(eventId);
    // Guests are logged out, so they can only see public events. Anything else behaves as missing.
    if (!event || !canSeeEvent(null, event)) return { success: false, message: 'Event not found' };

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
    let email = normalizeEmail(formData.get('email'));
    const photoUrl = formData.get('photoUrl');

    if (!username || !password || !name) {
      return { success: false, message: 'Username, password and name are required' };
    }
    if (email && !isValidEmail(email)) return EMAIL_INVALID;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return { success: false, message: 'Username already exists' };
    }
    // A public form must not reveal which emails have accounts: an email that is
    // already used is left off, and the guest can add one later in Settings.
    if (email && (await emailTakenByOther(email, null))) email = undefined;

    const userData = {
      username,
      password,
      role: 'volunteer',
      name,
      status: 'pending',
      age: age ? parseInt(age, 10) : null,
      mobile: mobile || '',
      ...(email ? { email } : {}),
      photoUrl: photoUrl || '',
      eventRegistrations: [{
        eventId,
        status: 'pending',
        comment: `I want to volunteer for this event: ${event.title}`,
        appliedAt: new Date()
      }]
    };

    try {
      await User.create(userData);
    } catch (error) {
      // Lost a race for the email: register without it rather than leak or fail.
      if (error?.code !== 11000 || !error.keyPattern?.email) throw error;
      delete userData.email;
      await User.create(userData);
    }
    
    revalidatePath('/admin/users');
    revalidatePath('/dashboard/registrations');
    return { success: true, pending: true };
  } catch (error) {
    console.error('Event registration error:', error);
    return { success: false, message: error.message };
  }
}

const MAX_VOLUNTEERS = 500;

export async function registerForEventLoggedIn(eventId, comment, volunteersCount = 1, volunteerNames = '') {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    await connectDB();
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, message: 'Not authenticated' };

    if (!isValidObjectId(eventId)) return { success: false, message: 'Event not found' };

    const event = await Event.findById(eventId);
    // An event the caller cannot see behaves exactly like a missing one.
    if (!event || !canSeeEvent(currentUser, event)) return { success: false, message: 'Event not found' };

    // A whole number of volunteers, 1–500. Only a SPOC registers more than one.
    const requested = typeof volunteersCount === 'string' && /^\d+$/.test(volunteersCount.trim())
      ? Number(volunteersCount.trim())
      : volunteersCount;
    if (!Number.isInteger(requested) || requested < 1 || requested > MAX_VOLUNTEERS) {
      return { success: false, message: `Choose between 1 and ${MAX_VOLUNTEERS} volunteers.` };
    }

    // Internal company events: employees of that company only.
    // Public events: an employee joins once any SPOC of their company has registered it.
    if (event.companyId) {
      if (currentUser.role === 'org_spoc') {
        return { success: false, message: 'This is an internal event for your company. Ask your team to register.' };
      }
      if (currentUser.role !== 'org_member') {
        return { success: false, message: 'Only members of the hosting company can register for this event.' };
      }
    } else if (currentUser.role === 'org_member') {
      // Fail closed: without a company, companyId: null could match a stray SPOC.
      if (!isCorporate(currentUser)) {
        return { success: false, message: 'Your account is not linked to a company. Please contact your SPOC.' };
      }
      const spocDoc = await User.findOne({
        role: 'org_spoc',
        companyId: currentUser.companyId,
        'eventRegistrations.eventId': eventId,
      });
      if (!spocDoc) {
        return { success: false, message: 'Your company has not registered for this event yet. Please contact your SPOC.' };
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
      const incomingCount = currentUser.role === 'org_spoc' ? requested : 1;
      if (totalRegistered + incomingCount > event.capacity) {
        const spotsLeft = event.capacity - totalRegistered;
        if (spotsLeft <= 0) return { success: false, message: 'This event is fully booked. No spots remaining.' };
        return { success: false, message: `Only ${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left. You requested ${incomingCount}.` };
      }
    }

    // Auto-approve all registrations
    let status = 'approved';

    const count = currentUser.role === 'org_spoc' ? requested : 1;

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
    return { success: false, message: 'Could not register you for this event. Please try again.' };
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

    if (!isValidObjectId(userId) || !isValidObjectId(eventId)) {
      return { success: false, message: 'Registration not found' };
    }

    // Check the caller may manage the event before revealing whether the user or registration exists.
    const event = await Event.findById(eventId);
    if (!event || !canManageEvent(currentUser, event)) {
      return { success: false, message: 'Not authorized. This user registered for another organizer\'s event.' };
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) return { success: false, message: 'User not found' };

    const regIndex = targetUser.eventRegistrations.findIndex(r => r.eventId.toString() === eventId.toString());
    if (regIndex === -1) return { success: false, message: 'Registration not found' };

    targetUser.eventRegistrations[regIndex].status = status;
    await targetUser.save();

    revalidatePath('/admin/users');
    revalidatePath('/dashboard/registrations');
    return { success: true };
  } catch (error) {
    console.error('Error updating event registration status:', error);
    return { success: false, message: 'Could not update the registration. Please try again.' };
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

const NOBODY = { _id: { $in: [] } };

// Who `user` may message, as a User filter; null when chat is not available for
// the role. getChatContacts lists these people and sendMessage only delivers to them.
function chatContactFilter(user) {
  if (!user) return null;
  switch (user.role) {
    case 'admin':
      return { role: { $in: ['ngo', 'org_spoc', 'employee'] } };
    case 'ngo':
    case 'employee':
      return { role: 'admin' };
    case 'org_spoc':
      // Fail closed: a SPOC without a company reaches admins only.
      return isCorporate(user)
        ? { $or: [{ role: 'admin' }, { role: 'org_member', companyId: user.companyId }] }
        : { role: 'admin' };
    case 'org_member':
      // Fail closed: an employee without a company reaches no one.
      return isCorporate(user) ? { role: 'org_spoc', companyId: user.companyId } : NOBODY;
    default:
      return null;
  }
}

export async function getChatContacts() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, message: 'Not authenticated' };
    await connectDB();

    const filter = chatContactFilter(currentUser);
    if (!filter) return { success: false, message: 'Chat not available for your role' };
    const contacts = await User.find(filter).select('name role companyId ngoId ngoName').lean();

    const unreadCounts = await Message.aggregate([
      { $match: { receiver: currentUser._id, read: false } },
      { $group: { _id: '$sender', count: { $sum: 1 } } },
    ]);
    const unreadMap = {};
    unreadCounts.forEach((u) => { unreadMap[u._id.toString()] = u.count; });

    const contactCompanies = await getCompaniesByIds(contacts.map((c) => c.companyId));
    const serialized = contacts.map((c) => ({
      _id: c._id.toString(),
      name: c.name,
      role: c.role,
      companyName: contactCompanies.get(String(c.companyId))?.name || null,
      ngoName: c.ngoName || null,
      ngoId: c.ngoId || null,
      unread: unreadMap[c._id.toString()] || 0,
    }));

    return { success: true, contacts: serialized };
  } catch (error) {
    console.error('Error getting chat contacts:', error);
    return { success: false, message: 'Could not load your contacts. Please try again.' };
  }
}

export async function getMessages(contactId) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, message: 'Not authenticated' };
    const contactFilter = chatContactFilter(currentUser);
    if (!contactFilter) return { success: false, message: 'Chat not available for your role' };
    await connectDB();

    // Same contact set as sendMessage; unknown and malformed ids answer the same.
    const refused = { success: false, message: 'You cannot view this conversation' };
    if (typeof contactId !== 'string' || !isValidObjectId(contactId)) return refused;
    if (!(await User.exists({ $and: [{ _id: contactId }, contactFilter] }))) return refused;

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
    return { success: false, message: 'Could not load messages. Please try again.' };
  }
}

export async function sendMessage(formData) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, message: 'Not authenticated' };
    const contactFilter = chatContactFilter(currentUser);
    if (!contactFilter) return { success: false, message: 'Chat not available for your role' };
    await connectDB();

    const receiverId = formData.get('receiverId');
    const content = formData.get('content')?.trim() || '';
    const fileUrl = formData.get('fileUrl') || null;
    const fileName = formData.get('fileName') || null;
    const fileType = formData.get('fileType') || null;

    if (!receiverId) return { success: false, message: 'Receiver is required' };
    if (!content && !fileUrl) return { success: false, message: 'Message or file is required' };

    // Only someone in the sender's contact list; unknown and malformed ids answer the same.
    const refused = { success: false, message: 'You cannot message this person' };
    if (typeof receiverId !== 'string' || !isValidObjectId(receiverId)) return refused;
    if (!(await User.exists({ $and: [{ _id: receiverId }, contactFilter] }))) return refused;

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
    return { success: false, message: 'Could not send your message. Please try again.' };
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
      // Public homepage: company-private partners are not counted.
      NGOPartner.countDocuments(partnerVisibilityFilter(null)),
      Company.countDocuments({ status: 'active' }),
    ]);
    const totalHours = totalHoursResult[0]?.total || 0;
    return {
      success: true,
      stats: {
        volunteerHours: totalHours,
        eventsCompleted: completedEvents,
        ngoPartners: ngoCount,
        organisations: orgUsers,
      }
    };
  } catch (error) {
    return { success: false, stats: { volunteerHours: 0, eventsCompleted: 0, ngoPartners: 0, organisations: 0 } };
  }
}

// Get registered count for an event (for capacity display and breakdown)
export async function getEventRegisteredCount(eventId) {
  const notFound = { success: false, message: 'Event not found' };
  try {
    if (typeof eventId !== 'string' || !isValidObjectId(eventId)) return notFound;
    await connectDB();
    const currentUser = await getCurrentUser();
    const event = await Event.findById(eventId).select('companyId').lean();
    // An event the caller cannot see answers exactly like a missing one.
    if (!event || !canSeeEvent(currentUser, event)) return notFound;
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
  } catch (error) {
    console.error('Error counting event registrations:', error);
    return { success: false, message: 'Could not load the registration count.' };
  }
}

// Get admin-wide dashboard impact analytics
export async function getAdminImpactStats(targetYear) {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };
    const user = await getCurrentUser();
    if (user?.role !== 'admin') return { success: false, message: 'Admin access required' };

    await connectDB();

    const year = targetYear ? parseInt(targetYear, 10) : new Date().getFullYear();

    // 1. Total KPI counters
    const [totalHoursResult, totalEvents, totalNGOs, totalOrgs] = await Promise.all([
      Attendance.aggregate([{ $match: { attended: true } }, { $group: { _id: null, total: { $sum: '$hoursContributed' } } }]),
      Event.countDocuments({ status: 'completed' }),
      NGOPartner.countDocuments(),
      Company.countDocuments({ status: 'active' }),
    ]);

    const totalHours = totalHoursResult[0]?.total || 0;

    // 2. Events completed by year and quarters
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
    
    const recentEvents = await Event.find({ status: 'completed', date: { $gte: startOfYear, $lte: endOfYear } }).select('date').lean();
    
    const monthlyEventsMap = {};
    for (let i = 0; i < 12; i++) {
      const d = new Date(year, i, 1);
      const mLabel = d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short' });
      monthlyEventsMap[mLabel] = 0;
    }

    recentEvents.forEach(e => {
      const mLabel = new Date(e.date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short' });
      if (mLabel in monthlyEventsMap) {
        monthlyEventsMap[mLabel]++;
      }
    });

    const monthlyEvents = Object.keys(monthlyEventsMap).map(key => ({
      month: key,
      count: monthlyEventsMap[key]
    }));

    const quarterlyMap = { Q1: { count: 0 }, Q2: { count: 0 }, Q3: { count: 0 }, Q4: { count: 0 } };
    monthlyEvents.forEach((m, idx) => {
      const q = Math.floor(idx / 3) + 1;
      quarterlyMap[`Q${q}`].count += m.count;
    });

    const quarterlyEvents = Object.keys(quarterlyMap).map(q => ({
      quarter: q,
      count: quarterlyMap[q].count
    }));

    // 3. Top corporate organisations by volunteer hours (overall or within year)
    // To match the CSR tracking, let's filter top corps by year
    const orgStats = await Attendance.aggregate([
      { $match: { attended: true, markedAt: { $gte: startOfYear, $lte: endOfYear } } },
      { $group: {
        _id: '$companyId',
        hours: { $sum: '$hoursContributed' },
        volunteers: { $sum: 1 }
      }},
      { $sort: { hours: -1 } },
      { $limit: 6 }
    ]);

    const topCompanies = await getCompaniesByIds(orgStats.map((o) => o._id));
    const topOrgs = orgStats.map((o) => ({
      name: topCompanies.get(String(o._id))?.name || 'Individual',
      hours: o.hours,
      volunteers: o.volunteers
    }));

    return {
      success: true,
      stats: {
        totalHours,
        totalEvents,
        totalNGOs,
        totalOrgs,
        monthlyEvents,
        quarterlyEvents,
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
    if (caller?.role !== 'admin' && caller?.role !== 'employee') {
      return { success: false, message: 'Unauthorized' };
    }

    await connectDB();

    // Get all events
    const events = await Event.find()
      .populate('createdBy', 'name role companyId')
      .sort({ date: -1 })
      .lean();

    // Aggregate joined count and spoc count from User model
    const registrationsAgg = await User.aggregate([
      { $unwind: '$eventRegistrations' },
      { $match: { 'eventRegistrations.status': 'approved' } },
      {
        $group: {
          _id: '$eventRegistrations.eventId',
          joinedCount: { 
            $sum: { $cond: [{ $ne: ['$role', 'org_spoc'] }, 1, 0] } 
          },
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

    // Aggregate Corporate Breakdown
    const corpDetailsAgg = await User.aggregate([
      { $unwind: '$eventRegistrations' },
      { $match: { 
          'eventRegistrations.status': 'approved',
          role: { $in: ['org_spoc', 'org_member'] }
        }
      },
      {
        $group: {
          _id: {
            eventId: '$eventRegistrations.eventId',
            companyId: '$companyId'
          },
          expected: {
            $sum: { $cond: [{ $eq: ['$role', 'org_spoc'] }, '$eventRegistrations.volunteersCount', 0] }
          },
          actual: {
            $sum: { $cond: [{ $eq: ['$role', 'org_member'] }, 1, 0] }
          }
        }
      }
    ]);

    const historyCompanies = await getCompaniesByIds([
      ...events.flatMap((e) => [e.companyId, e.createdBy?.companyId]),
      ...corpDetailsAgg.map((c) => c._id.companyId),
    ]);
    const nameOf = (id) => (id ? historyCompanies.get(String(id))?.name ?? null : null);

    const corpDetailsMap = corpDetailsAgg.reduce((acc, curr) => {
      const eventId = curr._id.eventId.toString();
      const orgName = nameOf(curr._id.companyId) || 'Unknown company';
      if (!acc[eventId]) acc[eventId] = [];
      acc[eventId].push({
        orgName,
        expected: curr.expected,
        actual: curr.actual
      });
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
        companyId: event.companyId ? String(event.companyId) : null,
        companyName: nameOf(event.companyId),
        createdBy: event.createdBy ? {
          _id: event.createdBy._id.toString(),
          name: event.createdBy.name,
          role: event.createdBy.role,
          companyName: nameOf(event.createdBy.companyId),
        } : null,
        joinedCount: regData.joinedCount,
        spocCount: regData.spocCount,
        attendanceCount: attData.attendanceCount,
        hoursLogged: attData.hoursLogged,
        corporateDetails: corpDetailsMap[eId] || [],
      };
    });

    return { success: true, history };
  } catch (error) {
    console.error('Error getting all events history:', error);
    return { success: false, message: error.message };
  }
}

export async function getAdminEventDetails(eventId) {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    const caller = await getCurrentUser();
    if (caller?.role !== 'admin' && caller?.role !== 'employee' && caller?.role !== 'org_spoc') {
      return { success: false, message: 'Unauthorized' };
    }
    // A SPOC is scoped to a company. Without one there is nothing to scope to, so fail closed.
    if (caller.role === 'org_spoc' && !caller.companyId) return { success: false, message: 'Unauthorized' };
    if (!isValidObjectId(String(eventId))) return { success: false, message: 'Event not found' };

    await connectDB();

    const event = await Event.findById(eventId)
      .populate('createdBy', 'name role companyId email')
      .lean();

    if (!event) return { success: false, message: 'Event not found' };
    if (!canSeeEvent(caller, event)) return { success: false, message: 'Unauthorized' };

    const registeredQuery = {
      'eventRegistrations': {
        $elemMatch: { eventId, status: 'approved' }
      }
    };

    if (caller.role === 'org_spoc') {
      registeredQuery.companyId = caller.companyId;
    }

    // Find users who are approved for this event
    const registeredUsers = await User.find(registeredQuery).select('name role companyId email').lean();
    const detailCompanies = await getCompaniesByIds([event.companyId, event.createdBy?.companyId, ...registeredUsers.map((u) => u.companyId)]);

    // Get attendance records
    const attendanceRecords = await Attendance.find({ eventId }).lean();
    const attMap = attendanceRecords.reduce((acc, curr) => {
      acc[curr.userId.toString()] = curr;
      return acc;
    }, {});

    // Combine users with attendance
    const participants = registeredUsers.map(u => {
      const att = attMap[u._id.toString()];
      return {
        _id: u._id.toString(),
        name: u.name,
        role: u.role,
        companyName: detailCompanies.get(String(u.companyId))?.name || null,
        email: u.email,
        attended: att ? att.attended : false,
        hoursContributed: att ? att.hoursContributed : 0,
        feedbackScore: att ? att.feedbackScore : null,
      };
    });

    return {
      success: true,
      event: {
        _id: event._id.toString(),
        title: event.title,
        description: event.description,
        date: event.date.toISOString(),
        location: event.location,
        durationHours: event.durationHours || 0,
        capacity: event.capacity,
        status: event.status,
        companyName: detailCompanies.get(String(event.companyId))?.name || null,
        createdBy: event.createdBy ? {
          name: event.createdBy.name,
          role: event.createdBy.role,
          companyName: detailCompanies.get(String(event.createdBy.companyId))?.name || null,
          email: event.createdBy.email
        } : null,
      },
      participants
    };
  } catch (error) {
    console.error('Error getting event details:', error);
    return { success: false, message: error.message };
  }
}

export async function getOrgEventsHistory(companyId) {
  try {
    await connectDB();
    const caller = await getCurrentUser();
    const access = resolveCompanyAccess(caller, companyId);
    if (access.error) return { success: false, message: access.error };
    if (!access.companyId) return { success: false, message: 'Company is required' };
    if (!isValidObjectId(access.companyId)) return { success: false, message: 'Company not found' };
    const ownCompany = access.companyId;

    // 1. Get all users from this org that have approved event registrations
    const orgUsers = await User.find({
      companyId: ownCompany,
      'eventRegistrations.status': 'approved',
      role: { $in: ['org_spoc', 'org_member'] }
    }).lean();

    const eventIdsSet = new Set();
    const registrationsByEvent = {}; // eventId -> []

    orgUsers.forEach(u => {
      u.eventRegistrations.forEach(reg => {
        if (reg.status === 'approved') {
          const eId = reg.eventId.toString();
          eventIdsSet.add(eId);
          if (!registrationsByEvent[eId]) registrationsByEvent[eId] = [];
          registrationsByEvent[eId].push({
            userId: u._id.toString(),
            name: u.name,
            role: u.role,
            volunteersCount: reg.volunteersCount || 0
          });
        }
      });
    });

    const eventIds = Array.from(eventIdsSet);

    // 2. Fetch those events
    const events = await Event.find({ _id: { $in: eventIds } }).sort({ date: -1 }).lean();

    // 3. Fetch attendance for this org for these events
    const attendanceRecords = await Attendance.find({
      eventId: { $in: eventIds },
      companyId: ownCompany,
      attended: true
    }).lean();

    const attendanceByEvent = {};
    attendanceRecords.forEach(a => {
      const eId = a.eventId.toString();
      if (!attendanceByEvent[eId]) attendanceByEvent[eId] = new Set();
      attendanceByEvent[eId].add(a.userId.toString());
    });

    // 4. Map everything
    const now = new Date();
    const history = events.map(event => {
      const eId = event._id.toString();
      const regs = registrationsByEvent[eId] || [];
      const atts = attendanceByEvent[eId] || new Set();

      let expected = 0;
      let joined = 0;
      const volunteers = [];

      regs.forEach(r => {
        if (r.role === 'org_spoc') {
          expected += r.volunteersCount;
        } else if (r.role === 'org_member') {
          expected += 1;
          joined += 1;
          const attended = atts.has(r.userId);
          volunteers.push({
            id: r.userId,
            name: r.name,
            attended
          });
        }
      });

      const start = new Date(event.date);
      const end = new Date(start.getTime() + (event.durationHours || 2) * 60 * 60 * 1000);
      let lifecycle = 'upcoming';
      if (now > end) lifecycle = 'ended';
      else if (now >= start && now <= end) lifecycle = 'live';

      return {
        _id: eId,
        title: event.title,
        date: event.date.toISOString(),
        location: event.location,
        type: event.companyId && String(event.companyId) === ownCompany ? 'internal' : 'global',
        // Any SPOC of the company may delete its internal events (spec §4.1).
        canDelete: canManageEvent(caller, event),
        status: lifecycle,
        expected,
        joined,
        volunteers
      };
    });

    return { success: true, history };
  } catch (error) {
    console.error('Error getting org events history:', error);
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

export async function updateProfileName(newName) {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'Not authenticated' };

    if (!newName || newName.trim() === '') {
      return { success: false, message: 'Name cannot be empty' };
    }

    await connectDB();
    const User = (await import('@/models/User')).default;

    await User.findByIdAndUpdate(session.userId, { name: newName.trim() });
    
    return { success: true };
  } catch (error) {
    console.error('Error updating profile name:', error);
    return { success: false, message: error.message };
  }
}

const EMAIL_INVALID = { success: false, message: 'Enter a valid email address' };
const EMAIL_TAKEN = { success: false, message: 'That email is already used by another account' };

// Another account already has this (normalised) email, in any letter case.
const emailTakenByOther = (email, userId) =>
  User.exists({ email, _id: { $ne: userId } }).collation(EMAIL_COLLATION);

// The caller's own email. Empty removes it. Never says which account has a taken email.
export async function updateEmail(newEmail) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, message: 'Not authenticated' };
    if (typeof newEmail !== 'string') return EMAIL_INVALID;

    const email = normalizeEmail(newEmail);
    await connectDB();
    if (!email) {
      await User.updateOne({ _id: user._id }, { $unset: { email: 1 } });
      return { success: true, email: '' };
    }
    if (!isValidEmail(email)) return EMAIL_INVALID;
    if (await emailTakenByOther(email, user._id)) return EMAIL_TAKEN;

    await User.updateOne({ _id: user._id }, { $set: { email } }, { runValidators: true });
    return { success: true, email };
  } catch (error) {
    // The unique index catches what the check above missed in a race.
    if (error?.code === 11000) return EMAIL_TAKEN;
    console.error('Error updating email:', error);
    return { success: false, message: 'Could not update your email. Please try again.' };
  }
}
