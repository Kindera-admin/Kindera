'use server'

import connectDB from '@/lib/db';
import Report from '@/models/Report';
import User from '@/models/User';
import Event from '@/models/Event';
import NGOPartner from '@/models/NGOPartner';
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
    
    if (user.role !== 'admin') {
      return { success: false, message: 'Only admin can register new users' };
    }
    
    const username = formData.get('username');
    const password = formData.get('password');
    const role = formData.get('role');
    const ngoId = formData.get('ngoId');
    const name = formData.get('name');
    const organizationName = formData.get('organizationName');
    
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
    
    await User.create(userData);
    
    revalidatePath('/admin/users');
    return { success: true };
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
    const users = await User.find({ _id: { $ne: currentUser._id } }).select('-password');
    
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
        has12A: user.has12A || false,
        reg12A: user.reg12A || '',
        has80G: user.has80G || false,
        reg80G: user.reg80G || '',
        hasFCRA: user.hasFCRA || false,
        regFCRA: user.regFCRA || '',
        createdAt: user.createdAt ? user.createdAt.toISOString() : null
      }))
    };
  } catch (error) {
    console.error('Error fetching users:', error);
    return { success: false, message: error.message };
  }
}

export async function updateUserStatus(formData) {
  const session = await getSession();
  if (!session) return { success: false, message: 'Not authenticated' };

  try {
    await connectDB();
    const currentUser = await getCurrentUser();
    if (currentUser.role !== 'admin') {
      return { success: false, message: 'Only admin can manage users' };
    }

    const userId = formData.get('userId');
    const status = formData.get('status');

    if (!['approved', 'rejected'].includes(status)) {
      return { success: false, message: 'Invalid status' };
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
    const registrationLink = formData.get('registrationLink');
    const capacity = formData.get('capacity');
    const imageUrl = formData.get('imageUrl');
    
    if (!title || !description || !date || !location || !registrationLink) {
      return { success: false, message: 'All required fields must be filled' };
    }
    
    const event = await Event.create({
      title,
      description,
      date: new Date(date),
      location,
      registrationLink,
      capacity: capacity ? parseInt(capacity) : null,
      imageUrl: imageUrl || '',
      createdBy: user._id,
      createdByRole: user.role,
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

    // Auto-mark past events as completed
    const now = new Date();
    await Event.updateMany(
      { date: { $lt: now }, status: 'upcoming' },
      { $set: { status: 'completed' } }
    );

    const events = await Event.find({ status: 'upcoming' })
      .sort({ date: 1 })
      .limit(6);

    return {
      success: true,
      events: events.map(event => ({
        _id: event._id.toString(),
        title: event.title,
        description: event.description,
        date: event.date.toISOString(),
        location: event.location,
        registrationLink: event.registrationLink,
        imageUrl: event.imageUrl,
        status: event.status,
      }))
    };
  } catch (error) {
    console.error('Error fetching home events:', error);
    return { success: false, events: [] };
  }
}

export async function getEvents(status = '') {
  try {
    await connectDB();

    const filter = {};
    if (status) filter.status = status;
    
    const events = await Event.find(filter)
      .populate('createdBy', 'name role')
      .sort({ date: 1 });
    
    return {
      success: true,
      events: events.map(event => ({
        _id: event._id.toString(),
        title: event.title,
        description: event.description,
        date: event.date.toISOString(),
        location: event.location,
        registrationLink: event.registrationLink,
        capacity: event.capacity,
        imageUrl: event.imageUrl,
        status: event.status,
        createdBy: event.createdBy ? {
          _id: event.createdBy._id.toString(),
          name: event.createdBy.name,
          role: event.createdBy.role
        } : null,
        createdAt: event.createdAt.toISOString()
      }))
    };
  } catch (error) {
    console.error('Error fetching events:', error);
    return { success: false, message: error.message };
  }
}

export async function getEventById(id) {
  try {
    await connectDB();
    
    const event = await Event.findById(id).populate('createdBy', 'name role');
    
    if (!event) {
      return { success: false, message: 'Event not found' };
    }
    
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
        imageUrl: event.imageUrl,
        status: event.status,
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
    const has12A = formData.get('has12A') === 'true';
    const reg12A = formData.get('reg12A') || '';
    const has80G = formData.get('has80G') === 'true';
    const reg80G = formData.get('reg80G') || '';
    const hasFCRA = formData.get('hasFCRA') === 'true';
    const regFCRA = formData.get('regFCRA') || '';

    // ── Validation ──
    if (!name || !username || !password || !confirmPassword || !organizationName) {
      return { success: false, message: 'All fields are required' };
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

    await User.create({
      name: name.trim(),
      username: username.toLowerCase().trim(),
      password,
      role: 'org_member',
      organizationName: organizationName.trim(),
      status: 'pending',
      mobile,
      has12A, reg12A,
      has80G, reg80G,
      hasFCRA, regFCRA,
    });

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
    if (user.role !== 'admin') return { success: false, message: 'Only admins can add NGO partners' };

    const name = formData.get('name')?.trim();
    const description = formData.get('description')?.trim();
    const focusAreas = formData.get('focusAreas')?.trim() || '';
    const programsRaw = formData.get('programs')?.trim() || '';
    const programs = programsRaw ? programsRaw.split('\n').map((l) => l.trim()).filter(Boolean) : [];
    const impact = formData.get('impact')?.trim() || '';
    const registeredOffice = formData.get('registeredOffice')?.trim() || '';
    const location = formData.get('location')?.trim() || '';
    const website = formData.get('website')?.trim() || '';

    if (!name || !description) {
      return { success: false, message: 'Name and description are required' };
    }

    const partner = await NGOPartner.create({ name, description, focusAreas, programs, impact, registeredOffice, location, website });

    revalidatePath('/ngo-partners');
    revalidatePath('/admin/ngo-partners');

    return {
      success: true,
      partner: {
        _id: partner._id.toString(),
        name: partner.name,
        description: partner.description,
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
    if (user.role !== 'admin') return { success: false, message: 'Only admins can delete NGO partners' };

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

