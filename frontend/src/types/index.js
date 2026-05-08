/**
 * Shared type definitions as JSDoc — used for editor autocomplete.
 * No TypeScript compilation required.
 *
 * @typedef {Object} User
 * @property {number} id
 * @property {string} name
 * @property {string} email
 * @property {'SUPER_ADMIN'|'DOCTOR'|'STAFF'} role
 * @property {number|null} doctorId
 *
 * @typedef {Object} Doctor
 * @property {number} id
 * @property {string} name
 * @property {string} specialty
 * @property {string} domain
 * @property {string} email
 * @property {'ACTIVE'|'INACTIVE'} status
 *
 * @typedef {Object} Lead
 * @property {number} id
 * @property {string} patientName
 * @property {string} phone
 * @property {string|null} email
 * @property {string|null} city
 * @property {string|null} source
 * @property {string|null} campaignName
 * @property {number} doctorId
 * @property {'NEW'|'CONTACTED'|'FOLLOW_UP'|'APPOINTMENT_BOOKED'|'CONVERTED'|'LOST'} status
 *
 * @typedef {Object} Appointment
 * @property {number} id
 * @property {string} patientName
 * @property {string} phone
 * @property {string|null} issue
 * @property {string} preferredDate
 * @property {'PENDING'|'CONFIRMED'|'COMPLETED'|'CANCELLED'|'RESCHEDULED'} status
 * @property {number} doctorId
 *
 * @typedef {Object} Blog
 * @property {number} id
 * @property {string} title
 * @property {string} slug
 * @property {string|null} featuredImage
 * @property {string} content
 * @property {string|null} seoTitle
 * @property {string|null} metaDescription
 * @property {string|null} keywords
 * @property {number} doctorId
 * @property {'DRAFT'|'PUBLISHED'} status
 */

export {};
