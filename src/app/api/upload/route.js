import { v2 as cloudinary } from 'cloudinary';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/heic', 'image/heif'];
const ALLOWED_DOC_TYPES   = ['application/pdf', 'application/msword',
                              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Every folder the app uploads into. Anything else is rejected.
const ALLOWED_FOLDERS = [
  'kindera/events',
  'kindera/chat',
  'kindera/documents',
  'kindera/impact-photos',
  'kindera/ngo-certificates',
  'kindera/ngo-partners',
  'kindera/organization-logos',
  'kindera/volunteers',
];
// Uploads made before the user has an account: NGO certificates on the
// signup form and the guest volunteer photo on public event registration.
// Without a login these folders accept only what those forms need, and
// never SVG (which can carry scripts).
const PUBLIC_FOLDERS = {
  'kindera/ngo-certificates': ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  'kindera/volunteers': ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
};
const PUBLIC_MAX_BYTES = 5 * 1024 * 1024; // 5 MB without a login

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file     = formData.get('file');
    const folder   = formData.get('folder') || 'kindera/events'; // pass 'kindera/documents' for NGO docs

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!ALLOWED_FOLDERS.includes(folder)) {
      return NextResponse.json({ error: 'Invalid upload folder' }, { status: 400 });
    }
    const user = await getCurrentUser();
    const anonymous = !user;
    if (anonymous && !PUBLIC_FOLDERS[folder]) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const allowedTypes = anonymous ? PUBLIC_FOLDERS[folder] : [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOC_TYPES];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type. Upload an image, PDF or Word document.' }, { status: 415 });
    }
    const limit = anonymous ? PUBLIC_MAX_BYTES : MAX_BYTES;
    if (file.size > limit) {
      return NextResponse.json({ error: `File is too large. The limit is ${limit / (1024 * 1024)} MB.` }, { status: 413 });
    }
    const isDoc = ALLOWED_DOC_TYPES.includes(file.type);

    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: isDoc ? 'raw' : 'image', // PDFs need 'raw' resource type
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(buffer);
    });

    return NextResponse.json({ url: result.secure_url });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
