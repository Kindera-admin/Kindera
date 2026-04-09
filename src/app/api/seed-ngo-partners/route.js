import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import NGOPartner from '@/models/NGOPartner';

const DEFAULT_PARTNERS = [
  {
    name: 'Anukulan',
    description: 'A social initiative established in 2015. In special consultative status at the United Nations Economic and Social Council since 2022.',
    focusAreas: 'Education, Environment Community, DEI for the benefit of underserved children, Youth, women, PWD, Elderly Care, children with visual and hearing impairments.',
    impact: 'Till today we are able to benefit more than 1 million underserved through our various programs led by our team and also involving volunteers across the Globe.',
    registeredOffice: 'New Delhi',
    programs: [],
    location: '',
    website: '',
  },
  {
    name: 'Jeevan Marga Charitable Trust',
    description: 'Jeevan Marga mainly focused on 5 thematic areas:',
    programs: [
      'Education - Nanna Shaale Sikshana (My School Education)',
      'WASH and MHM Arogyada',
      'Asha Kirana - Entrepreneurship program',
      'Organizing, Leadership and Livelihood training for women',
      'Environment and Climate Action - Rejuvenation of water bodies',
    ],
    registeredOffice: 'Bangalore',
    focusAreas: '',
    impact: '',
    location: '',
    website: '',
  },
  {
    name: 'Gully Classes Foundation',
    description: 'Working on environmental conservation and community cleanliness.',
    focusAreas: 'Beach/River cleanups',
    registeredOffice: 'Mumbai',
    programs: [],
    impact: '',
    location: '',
    website: '',
  },
  {
    name: 'Government Schools Across India',
    description: 'Partnership with government schools across India for educational initiatives and infrastructure development.',
    focusAreas: 'Education, Infrastructure, Student Support',
    location: 'Pan India',
    registeredOffice: '',
    programs: [],
    impact: '',
    website: '',
  },
  {
    name: 'Orphanages',
    description: "Supporting children's homes and orphanages with care, education, and development programs.",
    focusAreas: 'Child Welfare, Education, Healthcare',
    location: 'Various Locations',
    registeredOffice: '',
    programs: [],
    impact: '',
    website: '',
  },
  {
    name: 'Elderly Homes',
    description: 'Providing support and care services to senior citizens in elderly care facilities.',
    focusAreas: 'Elderly Care, Healthcare, Social Support',
    location: 'Various Locations',
    registeredOffice: '',
    programs: [],
    impact: '',
    website: '',
  },
  {
    name: 'Children Residential Homes',
    description: 'Supporting residential care facilities for children requiring special care and attention.',
    focusAreas: 'Child Welfare, Education, Residential Care',
    location: 'Various Locations',
    registeredOffice: '',
    programs: [],
    impact: '',
    website: '',
  },
];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (!secret || secret !== process.env.SETUP_SECRET) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectDB();

    const existing = await NGOPartner.countDocuments();
    if (existing > 0) {
      return NextResponse.json(
        { success: false, message: `${existing} partners already exist. Delete them first to re-seed.` },
        { status: 409 }
      );
    }

    await NGOPartner.insertMany(DEFAULT_PARTNERS);

    return NextResponse.json({ success: true, message: `Seeded ${DEFAULT_PARTNERS.length} NGO partners.` });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
