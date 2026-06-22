const mongoose = require('mongoose');
const { USER_ROLES, USER_ROLE_VALUES } = require('../../constant/constant');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },

    role: { type: String, enum: USER_ROLE_VALUES, required: true },

    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },

    // student placement (one class + one section); null for principal/teacher.
    // A TEACHER's section relation is NOT stored here — it lives entirely in
    // TeachingAssignment (teacher × subject × section), the single source of truth.
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', default: null },

    // DOB: required for teacher/student (their password is derived from it),
    // optional for principal (who chooses their own password).
    dateOfBirth: {
      type: Date,
      required: function () { return this.role !== USER_ROLES.PRINCIPAL; },
    },

    tokenVersion: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      // FIX FOR THE LEAK: strip sensitive/internal fields from every serialized
      // user, so even if a raw doc is returned the hash never reaches the client.
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.tokenVersion;
        return ret;
      },
    },
  }
);

// Email unique PER SCHOOL (multi-tenant), not globally.
userSchema.index({ schoolId: 1, email: 1 }, { unique: true });
userSchema.index({ schoolId: 1, role: 1, sectionId: 1 });

module.exports = mongoose.model('User', userSchema);