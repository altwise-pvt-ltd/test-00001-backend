// Validators for the submission module.
//  - create: a student submits a response tied to an assignment (step 6)
//  - grade:  a teacher records a grade + feedback (step 7)
const mongoose = require('mongoose');

const isObjectId = (v) => typeof v === 'string' && mongoose.isValidObjectId(v);

function validateCreateSubmission(body) {
  const errors = {};
  const value = {};

  if (!isObjectId(body.assignmentId)) {
    errors.assignmentId = 'A valid assignmentId is required';
  } else {
    value.assignmentId = body.assignmentId;
  }

  if (body.content !== undefined) {
    if (typeof body.content !== 'string') {
      errors.content = 'content must be a string';
    } else {
      value.content = body.content.trim();
    }
  }

  if (body.attachments !== undefined) {
    if (!Array.isArray(body.attachments) || body.attachments.some((a) => typeof a !== 'string')) {
      errors.attachments = 'attachments must be an array of strings';
    } else {
      value.attachments = body.attachments.map((a) => a.trim()).filter(Boolean);
    }
  }

  // A submission must carry something — text or at least one attachment.
  const hasContent = value.content && value.content.length > 0;
  const hasAttachments = value.attachments && value.attachments.length > 0;
  if (!errors.assignmentId && !hasContent && !hasAttachments) {
    errors.content = 'Provide content or at least one attachment';
  }

  return { valid: Object.keys(errors).length === 0, errors, value };
}

function validateGrade(body) {
  const errors = {};
  const value = {};

  if (typeof body.grade !== 'string' || body.grade.trim().length === 0) {
    errors.grade = 'grade is required (e.g. "A", "85", "Pass")';
  } else {
    value.grade = body.grade.trim();
  }

  if (body.feedback !== undefined) {
    if (typeof body.feedback !== 'string') {
      errors.feedback = 'feedback must be a string';
    } else {
      value.feedback = body.feedback.trim();
    }
  }

  return { valid: Object.keys(errors).length === 0, errors, value };
}

module.exports = { validateCreateSubmission, validateGrade };
