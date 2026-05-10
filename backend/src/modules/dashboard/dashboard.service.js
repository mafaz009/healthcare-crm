const prisma = require('../../config/database');

/**
 * Returns summary counts for the dashboard landing page.
 * SUPER_ADMIN gets platform-wide totals.
 * DOCTOR / STAFF get only their own doctor's data via tenantFilter.
 */
const getSummary = async (tenantFilter) => {
  const isSuperAdmin = Object.keys(tenantFilter).length === 0;

  const now       = new Date();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const weekAgo    = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);

  // ── All queries in parallel ─────────────────────────────────────────────────
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

    // Doctor counts (super admin only)
    totalDoctors,
    activeDoctors,

    // Recent activity (last 5)
    recentLeads,
    recentAppointments,

    // Status breakdowns
    leadsByStatus,
    appointmentsByStatus,

    // ── Follow-up widgets ────────────────────────────────────────────────────
    // Overdue: followUpAt is in the past and not null (pending)
    overdueFollowUps,
    // Today's follow-ups: scheduledAt is today and not yet completed
    todayFollowUps,
    // Upcoming (next 7 days, excluding today, not completed)
    upcomingFollowUps,

    // ── Conversion metrics ───────────────────────────────────────────────────
    closedLeads,
    appointmentBookedLeads,
  ] = await Promise.all([
    // ── Lead counts ──────────────────────────────────────────────────────────
    prisma.lead.count({ where: { ...tenantFilter } }),
    prisma.lead.count({ where: { ...tenantFilter, status: 'NEW' } }),

    // ── Appointment counts ───────────────────────────────────────────────────
    prisma.appointment.count({ where: { ...tenantFilter } }),
    prisma.appointment.count({ where: { ...tenantFilter, status: 'PENDING' } }),
    prisma.appointment.count({
      where: { ...tenantFilter, preferredDate: { gte: todayStart, lte: todayEnd } },
    }),

    // ── Blog counts ──────────────────────────────────────────────────────────
    prisma.blog.count({ where: { ...tenantFilter } }),
    prisma.blog.count({ where: { ...tenantFilter, status: 'PUBLISHED' } }),

    // ── Weekly trends ────────────────────────────────────────────────────────
    prisma.lead.count({ where: { ...tenantFilter, createdAt: { gte: weekAgo } } }),
    prisma.appointment.count({ where: { ...tenantFilter, createdAt: { gte: weekAgo } } }),

    // ── Super-admin only doctor counts ───────────────────────────────────────
    isSuperAdmin ? prisma.doctor.count()                                : Promise.resolve(0),
    isSuperAdmin ? prisma.doctor.count({ where: { status: 'ACTIVE' } }) : Promise.resolve(0),

    // ── Recent activity ───────────────────────────────────────────────────────
    prisma.lead.findMany({
      where: { ...tenantFilter },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true, patientName: true, phone: true, status: true,
        source: true, createdAt: true, followUpAt: true,
        assignedUser: { select: { id: true, name: true } },
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

    // ── Pipeline breakdowns ───────────────────────────────────────────────────
    prisma.lead.groupBy({
      by: ['status'],
      where: { ...tenantFilter },
      _count: { _all: true },
    }),
    prisma.appointment.groupBy({
      by: ['status'],
      where: { ...tenantFilter },
      _count: { _all: true },
    }),

    // ── Follow-up widgets ─────────────────────────────────────────────────────
    // Overdue: past, not completed
    prisma.leadFollowUp.count({
      where: {
        completedAt: null,
        scheduledAt: { lt: now },
        lead: { ...tenantFilter },
      },
    }),
    // Today: today range, not completed
    prisma.leadFollowUp.findMany({
      where: {
        completedAt: null,
        scheduledAt: { gte: todayStart, lte: todayEnd },
        lead: { ...tenantFilter },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 10,
      select: {
        id: true, scheduledAt: true, note: true,
        lead: {
          select: {
            id: true, patientName: true, phone: true, status: true,
            assignedUser: { select: { id: true, name: true } },
          },
        },
        user: { select: { id: true, name: true } },
      },
    }),
    // Upcoming 7 days (after today)
    prisma.leadFollowUp.count({
      where: {
        completedAt: null,
        scheduledAt: { gt: todayEnd, lte: new Date(todayEnd.getTime() + 7 * 24 * 60 * 60 * 1000) },
        lead: { ...tenantFilter },
      },
    }),

    // ── Conversion metrics ────────────────────────────────────────────────────
    prisma.lead.count({ where: { ...tenantFilter, status: 'CLOSED' } }),
    prisma.lead.count({ where: { ...tenantFilter, status: 'APPOINTMENT_BOOKED' } }),
  ]);

  // ── Compute conversion % (closed + appt booked out of total) ───────────────
  const convertedCount     = closedLeads + appointmentBookedLeads;
  const conversionRate     = totalLeads > 0
    ? Math.round((convertedCount / totalLeads) * 100)
    : 0;

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
      leads:        leadsByStatus.map((r) => ({ status: r.status, count: r._count._all })),
      appointments: appointmentsByStatus.map((r) => ({ status: r.status, count: r._count._all })),
    },
    recent: {
      leads:        recentLeads,
      appointments: recentAppointments,
    },
    followUps: {
      overdue:   overdueFollowUps,
      today:     todayFollowUps,
      upcoming:  upcomingFollowUps,
    },
    conversion: {
      closed:          closedLeads,
      appointmentBooked: appointmentBookedLeads,
      total:           totalLeads,
      rate:            conversionRate,  // percentage
    },
  };
};

module.exports = { getSummary };
