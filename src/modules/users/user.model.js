const mongoose = require('mongoose');
const { USER_ROLES, USER_ROLE_VALUES } = require('../../constant/constant');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },

    role: { type: String, enum: USER_ROLE_VALUES, required: true },

    // schoolId is the tenant fence. Required for teacher/student (they always
    // belong to exactly one school). NULLABLE for:
    //   - super-admin : lives ABOVE the tenant boundary, never belongs to a school
    //   - principal   : exists UNASSIGNED (schoolId null) until a super-admin
    //                   assigns them to a school via PATCH /schools/:id/principal
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: function () {
        return this.role !== USER_ROLES.SUPER_ADMIN && this.role !== USER_ROLES.PRINCIPAL;
      },
      default: null,
      index: true,
    },

    // student placement (one class + one section); null for principal/teacher.
    // super-admins have neither. A TEACHER's section relation is NOT stored here
    // — it lives entirely in SubjectAllocation (teacher × subject × section),
    // the single source of truth.
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', default: null },

    // DOB: required for teacher/student (their password is derived from it),
    // optional for principal and super-admin (who choose their own password).
    dateOfBirth: {
      type: Date,
      required: function () {
        return this.role !== USER_ROLES.PRINCIPAL && this.role !== USER_ROLES.SUPER_ADMIN;
      },
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

// Email unique PER SCHOOL (multi-tenant), not globally — but ONLY for users that
// actually have a school. Made partial on schoolId so the many null-school users
// (super-admins, unassigned principals) are exempt and never collide here: a
// plain compound unique index treats null as a value, so two null-school users
// sharing an email would clash. Their uniqueness is handled by the role-scoped
// partial indexes below instead.
userSchema.index(
  { schoolId: 1, email: 1 },
  { unique: true, partialFilterExpression: { schoolId: { $type: 'objectId' } } }
);
userSchema.index({ schoolId: 1, role: 1, sectionId: 1 });

// Email uniqueness for the null-school roles, enforced GLOBALLY within each role
// via partial unique indexes. Distinct index names are required because the key
// pattern ({ email: 1 }) is identical; Mongoose would otherwise auto-name both
// `email_1` and collide. The create endpoints (createAdmin script, principals
// service) also pre-check for a friendly 409 — these indexes are the backstop.
userSchema.index(
  { email: 1 },
  { unique: true, name: 'uniq_superadmin_email', partialFilterExpression: { role: USER_ROLES.SUPER_ADMIN } }
);
userSchema.index(
  { email: 1 },
  { unique: true, name: 'uniq_principal_email', partialFilterExpression: { role: USER_ROLES.PRINCIPAL } }
);

module.exports = mongoose.model('User', userSchema);