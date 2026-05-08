const prisma = require('../../config/database');

/**
 * Returns summary counts for the dashboard landing page.
 * SUPER_ADMIN gets platform-wide totals.
 * DOCTOR / STAFF get only their own doctor's data via tenantFilter.
 */
const getSummary = async (tenantFilter) => {
  const isSuperAdmin = Object.keys(tenantFilter).length === 0;

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  // Run all counts in parallel for speed
  const [
    totalLeads,
    newLeads,
    totalAppointments,
    pendingAppointments,
    todayAppointments,
    totalBlogs,
    publishedBlogs,
    leadsThisWeek,
    appointmentsThisWeek,

    // Super admin only
    totalDoctors,
    activeDoctors,

    recentLeads,
    recentAppointments,

    leadsByStatus,
    appointmentsByStatus,
  ] = await Promise.all([
    // Leads
    prisma.lead.count({ where: { ...tenantFilter } }),
    prisma.lead.count({ where: { ...tenantFilter, status: 'NEW' } }),

    // Appointments
    prisma.appointment.count({ where: { ...tenantFilter } }),
    prisma.appointment.count({ where: { ...tenantFilter, status: 'PENDING' } }),
    prisma.appointment.count({
      where: { ...tenantFilter, preferredDate: { gte: todayStart, lte: todayEnd } },
    }),

    // Blogs
    prisma.blog.count({ where: { ...tenantFilter } }),
    prisma.blog.count({ where: { ...tenantFilter, status: 'PUBLISHED' } }),

    // Trends (this week)
    prisma.lead.count({ where: { ...tenantFilter, createdAt: { gte: weekAgo } } }),
    prisma.appointment.count({ where: { ...tenantFilter, createdAt: { gte: weekAgo } } }),

    // Doctor counts (super admin only, returns 0 for others)
    isSuperAdmin ? prisma.doctor.count()                             : Promise.resolve(0),
    isSuperAdmin ? prisma.doctor.count({ where: { status: 'ACTIVE' } }) : Promise.resolve(0),

    // Recent activity (last 5)
    prisma.lead.findMany({
      where: { ...tenantFilter },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true, patientName: true, phone: true, status: true,
        source: true, createdAt: true,
        doctor: { select: { id: true, name: true } },
      },
    }),
    prisma.appointment.findMany({
      where: { ...tenantFilter },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true, patientName: true, phone: true, status: true,
        preferredDate: true, preferredTime: true,
        doctor: { select: { id: true, name: true } },
      },
    }),

    // Lead pipeline breakdown
    prisma.lead.groupBy({
      by: ['status'],
      where: { ...tenantFilter },
      _count: { _all: true },
    }),

    // Appointment status breakdown
    prisma.appointment.groupBy({
      by: ['status'],
      where: { ...tenantFilter },
      _count: { _all: true },
    }),
  ]);

  return {
    counts: {
      leads:              totalLeads,
      newLeads,
      appointments:       totalAppointments,
      pendingAppointments,
      todayAppointments,
      blogs:              totalBlogs,
      publishedBlogs,
      ...(isSuperAdmin && { doctors: totalDoctors, activeDoctors }),
    },
    thisWeek: {
      leads:        leadsThisWeek,
      appointments: appointmentsThisWeek,
    },
    pipeline: {
      leads: leadsByStatus.map((r) => ({ status: r.status, count: r._count._all })),
      appointments: appointmentsByStatus.map((r) => ({ status: r.status, count: r._count._all })),
    },
    recent: {
      leads:        recentLeads,
      appointments: recentAppointments,
    },
  };
};

module.exports = { getSummary };
