// Shared donation category enum. Single source of truth used by:
//   - the Donation Mongoose schema (enum validation)
//   - the donation Zod schema (request validation)
//   - Phase 7 analytics (category breakdown)

const CATEGORIES = Object.freeze([
  'prepared-meals',
  'bakery',
  'produce',
  'dairy',
  'packaged',
  'beverages',
  'frozen',
  'other',
]);

module.exports = { CATEGORIES };