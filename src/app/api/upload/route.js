import { v2 as cloudinary } from 'cloudinary';
import { NextResponse } from 'next/server';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/heic', 'image/heif'];
const ALLOWED_DOC_TYPES   = ['application/pdf', 'application/msword',
                              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file     = formData.get('file');
    const folder   = formData.get('folder') || 'kindera/events'; // pass 'kindera/documents' for NGO docs

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    const isDoc = file.type === 'application/pdf' || file.type.includes('wordprocessingml') || file.type === 'application/msword';

    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: isDoc ? 'raw' : 'image', // PDFs need 'raw' resource type
          format: isDoc ? undefined : undefined,
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
    return NextResponse.json(
      { error: error.message || 'Upload failed' }, 
      { status: 500 }
    );
  }
}
