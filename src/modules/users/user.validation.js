// Validator for creating teachers/students via the users module.
const mongoose = require('mongoose');
const { USER_ROLES } = require('../../constant/constant');

const isObjectId = (v) => typeof v === 'string' && mongoose.isValidObjectId(v);
const isEmail = (v) => typeof v === 'string' && /^\S+@\S+\.\S+$/.test(v);

function validateCreateUser(body) {
  const errors = {};
  const value = {};

  if (typeof body.name !== 'string' || body.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters';
  } else {
    value.name = body.name.trim();
  }

  if (!isEmail(body.email)) {
    errors.email = 'A valid email is required';
  } else {
    value.email = body.email.trim().toLowerCase();
  }

  // only teacher or student may be created here
  if (![USER_ROLES.TEACHER, USER_ROLES.STUDENT].includes(body.role)) {
    errors.role = 'Role must be teacher or student';
  } else {
    value.role = body.role;
  }

  // DOB required (password is derived from it)
  const dob = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
  if (!dob || Number.isNaN(dob.getTime())) {
    errors.dateOfBirth = 'A valid dateOfBirth is required';
  } else {
    value.dateOfBirth = dob;
  }

  // students need BOTH class + section (valid ObjectIds); teachers must carry
  // neither (their sections come from their TeachingAssignments).
  if (body.role === USER_ROLES.STUDENT) {
    if (!isObjectId(body.classId)) errors.classId = 'A valid classId is required for students';
    else value.classId = body.classId;
    if (!isObjectId(body.sectionId)) errors.sectionId = 'A valid sectionId is required for students';
    else value.sectionId = body.sectionId;
  } else if (body.role === USER_ROLES.TEACHER) {
    if (body.classId !== undefined) errors.classId = 'Teachers must not have a classId';
    if (body.sectionId !== undefined) errors.sectionId = 'Teachers must not have a sectionId';
  }

  return { valid: Object.keys(errors).length === 0, errors, value };
}

// UPDATE: only a small, safe set of fields may change here. role/email/dob are
// immutable via this route (they drive identity and the derived password).
function validateUpdateUser(body) {
  const errors = {};
  const value = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    } else {
      value.name = body.name.trim();
    }
  }

  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') {
      errors.isActive = 'isActive must be a boolean';
    } else {
      value.isActive = body.isActive;
    }
  }

  return { valid: Object.keys(errors).length === 0, errors, value };
}

// SET TEACHER TEACHING — the principal sends the FULL desired set of
// { subjectId, sectionId } pairs for a teacher. The service diffs against the
// current set (add new, revive removed, soft-delete dropped). An empty array is
// valid and clears all of the teacher's teaching assignments.
function validateSetTeacherTeaching(body) {
  const errors = {};
  const value = {};

  const list = body.teachingAssignments;
  if (!Array.isArray(list)) {
    errors.teachingAssignments = 'teachingAssignments must be an array of { subjectId, sectionId }';
    return { valid: false, errors, value };
  }

  const items = [];
  list.forEach((item, i) => {
    if (!item || typeof item !== 'object') {
      errors[`teachingAssignments[${i}]`] = 'Each entry must be an object with subjectId and sectionId';
      return;
    }
    const okSubject = isObjectId(item.subjectId);
    const okSection = isObjectId(item.sectionId);
    if (!okSubject) errors[`teachingAssignments[${i}].subjectId`] = 'A valid subjectId is required';
    if (!okSection) errors[`teachingAssignments[${i}].sectionId`] = 'A valid sectionId is required';
    if (okSubject && okSection) {
      items.push({ subjectId: item.subjectId, sectionId: item.sectionId });
    }
  });

  value.teachingAssignments = items;
  return { valid: Object.keys(errors).length === 0, errors, value };
}

module.exports = {
  validateCreateUser,
  validateUpdateUser,
  validateSetTeacherTeaching,
};