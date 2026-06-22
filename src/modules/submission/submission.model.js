const mongoose = require('mongoose');
const { SUBMISSION_STATUS_VALUES, SUBMISSION_STATUS } = require('../../constant/constant');

// Submission = a student's response to an Assignment. The teacher who owns the
// assignment's TeachingAssignment grades it (grade + feedback).
const submissionSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // role 'student' (validated in service)
      required: true,
      index: true,
    },

    content: {
      type: String,
      trim: true,
      default: '',
    },
    attachments: {
      type: [String],
      default: [],
    },

    status: {
      type: String,
      enum: SUBMISSION_STATUS_VALUES,
      default: SUBMISSION_STATUS.SUBMITTED,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },

    // ---- teacher fills these on grading ----
    grade: {
      type: String, // string keeps it flexible: "A", "85", "Pass"
      default: null,
    },
    feedback: {
      type: String,
      trim: true,
      default: null,
    },
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    gradedAt: {
      type: Date,
      default: null,
    },

    // TENANT key
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },

    // audit / lifecycle
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// one submission per student per assignment (the unique constraint that stops
// duplicate submissions). Drop/adjust if you want to allow resubmissions.
submissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('Submission', submissionSchema);