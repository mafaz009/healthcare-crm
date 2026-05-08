const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ── 1. Super Admin ──────────────────────────────────────────────────────────
  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'admin@youragency.com' },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('Admin@1234', 12);
    await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: 'admin@youragency.com',
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });
    console.log('✓ Super Admin created — email: admin@youragency.com  password: Admin@1234');
    console.log('  ⚠️  Change the password immediately after first login!');
  } else {
    console.log('✓ Super Admin already exists — skipping');
  }

  // ── 2. Sample Doctor (for development only) ──────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const existingDoctor = await prisma.doctor.findUnique({
      where: { email: 'dr.smith@example.com' },
    });

    if (!existingDoctor) {
      const doctor = await prisma.doctor.create({
        data: {
          name: 'Dr. John Smith',
          specialty: 'General Physician',
          domain: 'drjohnsmith.com',
          email: 'dr.smith@example.com',
          phone: '+91-9876543210',
          status: 'ACTIVE',
          apiKey: crypto.randomBytes(32).toString('hex'),
        },
      });

      // Create a doctor-role login for this sample doctor
      const hashedPassword = await bcrypt.hash('Doctor@1234', 12);
      await prisma.user.create({
        data: {
          name: 'Dr. John Smith',
          email: 'dr.smith@example.com',
          password: hashedPassword,
          role: 'DOCTOR',
          doctorId: doctor.id,
          isActive: true,
        },
      });

      // Sample lead
      const lead = await prisma.lead.create({
        data: {
          patientName: 'Alice Johnson',
          phone: '+91-9876500001',
          email: 'alice@example.com',
          city: 'Mumbai',
          source: 'facebook',
          campaignName: 'Summer Health Campaign',
          status: 'NEW',
          doctorId: doctor.id,
        },
      });

      // Sample appointment
      await prisma.appointment.create({
        data: {
          patientName: 'Bob Williams',
          phone: '+91-9876500002',
          issue: 'Routine checkup',
          preferredDate: new Date('2025-08-15'),
          preferredTime: '10:00 AM',
          status: 'PENDING',
          source: 'website',
          doctorId: doctor.id,
        },
      });

      // Sample blog
      await prisma.blog.create({
        data: {
          title: 'How to Manage Diabetes Through Diet',
          slug: 'how-to-manage-diabetes-through-diet',
          content: '<p>Managing diabetes through a balanced diet is one of the most effective ways...</p>',
          seoTitle: 'Manage Diabetes Through Diet | Dr. John Smith',
          metaDescription: 'Learn how a healthy diet helps manage diabetes effectively. Expert advice from Dr. John Smith, General Physician.',
          keywords: 'diabetes diet, manage diabetes, diabetes food',
          status: 'PUBLISHED',
          publishedAt: new Date(),
          doctorId: doctor.id,
        },
      });

      console.log(`✓ Sample doctor created — email: dr.smith@example.com  password: Doctor@1234`);
      console.log(`  Doctor ID: ${doctor.id}  API Key: ${doctor.apiKey}`);
      console.log('✓ Sample lead, appointment, and blog created');
    } else {
      console.log('✓ Sample doctor already exists — skipping');
    }
  }

  console.log('\nSeed complete.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
