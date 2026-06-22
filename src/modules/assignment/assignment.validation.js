// Validators for the assignment (homework) module. A teacher supplies the
// content plus the teachingAssignmentId that authorizes it; the section is
// derived from that teaching assignment in the service, never sent by the client.
const mongoose = require('mongoose');
const { ASSIGNMENT_TYPE_VALUES } = require('../../constant/constant');

const isObjectId = (v) => typeof v === 'string' && mongoose.isValidObjectId(v);

function parseDate(v) {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Shared: validate the optional content fields (title excluded — required-ness
// differs between create and update). Mutates errors/value.
function applyOptionalFields(body, errors, value) {
  if (body.description !== undefined) {
    if (typeof body.description !== 'string') {
      errors.description = 'description must be a string';
    } else {
      value.description = body.description.trim();
    }
  }

  if (body.type !== undefined) {
    if (!ASSIGNMENT_TYPE_VALUES.includes(body.type)) {
      errors.type = `type must be one of: ${ASSIGNMENT_TYPE_VALUES.join(', ')}`;
    } else {
      value.type = body.type;
    }
  }

  if (body.attachments !== undefined) {
    if (!Array.isArray(body.attachments) || body.attachments.some((a) => typeof a !== 'string')) {
      errors.attachments = 'attachments must be an array of strings';
    } else {
      value.attachments = body.attachments.map((a) => a.trim()).filter(Boolean);
    }
  }

  if (body.dueDate !== undefined && body.dueDate !== null) {
    const d = parseDate(body.dueDate);
    if (!d) {
      errors.dueDate = 'dueDate must be a valid date';
    } else {
      value.dueDate = d;
    }
  } else if (body.dueDate === null) {
    value.dueDate = null;
  }
}

function validateCreateAssignment(body) {
  const errors = {};
  const value = {};

  if (typeof body.title !== 'string' || body.title.trim().length < 2) {
    errors.title = 'title must be at least 2 characters';
  } else {
    value.title = body.title.trim();
  }

  if (!isObjectId(body.teachingAssignmentId)) {
    errors.teachingAssignmentId = 'A valid teachingAssignmentId is required';
  } else {
    value.teachingAssignmentId = body.teachingAssignmentId;
  }

  applyOptionalFields(body, errors, value);

  return { valid: Object.keys(errors).length === 0, errors, value };
}

function validateUpdateAssignment(body) {
  const errors = {};
  const value = {};

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim().length < 2) {
      errors.title = 'title must be at least 2 characters';
    } else {
      value.title = body.title.trim();
    }
  }

  applyOptionalFields(body, errors, value);

  if (Object.keys(errors).length === 0 && Object.keys(value).length === 0) {
    errors.body = 'No valid fields to update';
  }

  return { valid: Object.keys(errors).length === 0, errors, value };
}

module.exports = { validateCreateAssignment, validateUpdateAssignment };
