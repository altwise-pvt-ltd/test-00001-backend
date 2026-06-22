// Centralized enums / constants. Single source of truth for roles, statuses, etc.

const USER_ROLES = Object.freeze({
  PRINCIPAL: 'principal',
  TEACHER: 'teacher',
  STUDENT: 'student',
});

const ASSIGNMENT_TYPES = Object.freeze({
  HOMEWORK: 'homework',
  READING: 'reading',
  BOOK: 'book',
});

const SUBMISSION_STATUS = Object.freeze({
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  GRADED: 'graded',
});

// Canonical class/grade levels. A school creates one Class document per level
// it actually runs, but the *level number* (not a free-text name) is the stable
// key — so "grade 5" means the same thing in every school and relations line up.
// Change MAX to support more grades; extend with KG/pre-primary later if needed.
const CLASS_LEVEL_MIN = 1;
const CLASS_LEVEL_MAX = 12;
const CLASS_LEVELS = Object.freeze(
  Array.from({ length: CLASS_LEVEL_MAX - CLASS_LEVEL_MIN + 1 }, (_, i) => CLASS_LEVEL_MIN + i)
);

module.exports = {
  USER_ROLES,
  ASSIGNMENT_TYPES,
  SUBMISSION_STATUS,
  CLASS_LEVELS,
  CLASS_LEVEL_MIN,
  CLASS_LEVEL_MAX,
  USER_ROLE_VALUES: Object.values(USER_ROLES),
  ASSIGNMENT_TYPE_VALUES: Object.values(ASSIGNMENT_TYPES),
  SUBMISSION_STATUS_VALUES: Object.values(SUBMISSION_STATUS),
};