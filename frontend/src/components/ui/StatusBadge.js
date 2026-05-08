import clsx from 'clsx';

const COLORS = {
  // Lead statuses
  NEW:               'bg-blue-100 text-blue-700',
  CONTACTED:         'bg-yellow-100 text-yellow-700',
  FOLLOW_UP:         'bg-orange-100 text-orange-700',
  APPOINTMENT_BOOKED:'bg-purple-100 text-purple-700',
  CONVERTED:         'bg-green-100 text-green-700',
  LOST:              'bg-red-100 text-red-700',
  // Appointment statuses
  PENDING:           'bg-yellow-100 text-yellow-700',
  CONFIRMED:         'bg-blue-100 text-blue-700',
  COMPLETED:         'bg-green-100 text-green-700',
  CANCELLED:         'bg-red-100 text-red-700',
  RESCHEDULED:       'bg-purple-100 text-purple-700',
  // Blog statuses
  DRAFT:             'bg-gray-100 text-gray-600',
  PUBLISHED:         'bg-green-100 text-green-700',
  // Doctor statuses
  ACTIVE:            'bg-green-100 text-green-700',
  INACTIVE:          'bg-gray-100 text-gray-600',
};

const LABELS = {
  NEW: 'New', CONTACTED: 'Contacted', FOLLOW_UP: 'Follow-up',
  APPOINTMENT_BOOKED: 'Appt. Booked', CONVERTED: 'Converted', LOST: 'Lost',
  PENDING: 'Pending', CONFIRMED: 'Confirmed', COMPLETED: 'Completed',
  CANCELLED: 'Cancelled', RESCHEDULED: 'Rescheduled',
  DRAFT: 'Draft', PUBLISHED: 'Published',
  ACTIVE: 'Active', INACTIVE: 'Inactive',
};

export default function StatusBadge({ status }) {
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', COLORS[status] || 'bg-gray-100 text-gray-600')}>
      {LABELS[status] || status}
    </span>
  );
}
