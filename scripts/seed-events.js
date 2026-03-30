const { mongoose } = require('mongoose');
const path = require('path');

// Load .env.local file
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Please define the MONGODB_URI environment variable');
  process.exit(1);
}

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  location: {
    type: String
  },
  registrationLink: {
    type: String,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'completed'],
    default: 'upcoming'
  }
}, {
  timestamps: true
});

async function seedEvents() {
  try {
    // Connect to the database
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Create Event model
    const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);
    
    // Check if events already exist
    const existingEvents = await Event.countDocuments();
    
    if (existingEvents > 0) {
      console.log(`${existingEvents} events already exist in the database`);
      console.log('Skipping seeding to avoid duplicates');
      await mongoose.disconnect();
      return;
    }
    
    // Sample events data
    const events = [
      {
        title: "Community Health Camp",
        description: "Free health checkup and awareness program for underprivileged communities. Medical professionals will be available for consultations.",
        date: new Date('2026-02-15'),
        location: "Community Center, Bengaluru",
        registrationLink: "https://forms.google.com/your-form-link-1",
        status: "upcoming"
      },
      {
        title: "Educational Workshop",
        description: "Interactive learning sessions for children focusing on digital literacy and creative skills development.",
        date: new Date('2026-02-22'),
        location: "Government School, Whitefield",
        registrationLink: "https://forms.google.com/your-form-link-2",
        status: "upcoming"
      },
      {
        title: "Environmental Awareness Drive",
        description: "Tree plantation drive and plastic waste management workshop to promote sustainable living practices.",
        date: new Date('2026-03-05'),
        location: "Cubbon Park, Bengaluru",
        registrationLink: "https://forms.google.com/your-form-link-3",
        status: "upcoming"
      },
      {
        title: "Blood Donation Camp",
        description: "Annual blood donation drive in collaboration with local hospitals to help patients in need.",
        date: new Date('2026-03-12'),
        location: "Tech Park, Electronic City",
        registrationLink: "https://forms.google.com/your-form-link-4",
        status: "upcoming"
      },
      {
        title: "Skill Development Training",
        description: "Vocational training program for underprivileged youth focusing on employability skills and career guidance.",
        date: new Date('2026-03-20'),
        location: "Community Hall, Jayanagar",
        registrationLink: "https://forms.google.com/your-form-link-5",
        status: "upcoming"
      }
    ];
    
    // Insert events
    await Event.insertMany(events);
    
    console.log('✅ Successfully seeded 5 sample events:');
    events.forEach((event, index) => {
      console.log(`   ${index + 1}. ${event.title} - ${event.date.toDateString()}`);
    });
    
    console.log('\nYou can now:');
    console.log('- View these events on the dashboard');
    console.log('- Register for events as org_spoc or org_member');
    console.log('- Create new events as admin, ngo, or org_spoc');
    console.log('\nNote: Update the registrationLink URLs with your actual Google Form links!');
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error seeding events:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedEvents();
