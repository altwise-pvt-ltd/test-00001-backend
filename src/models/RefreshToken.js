// Refresh token store. The raw token is an opaque random string handed to the
// client in an httpOnly cookie; we persist only its SHA-256 hash, so a DB leak
// never exposes a usable token. Tokens are rotated on every refresh: the old row
// is marked revoked and `replacedBy` points at its successor (an audit chain).
const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Nullable: super-admins and unassigned principals have no school but still
    // get refresh tokens. Set from the user's schoolId at issue time.
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      default: null,
      index: true,
    },

    // SHA-256 hex of the raw token. Unique so a presented token maps to one row.
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },

    expiresAt: { type: Date, required: true },

    revoked: { type: Boolean, default: false },

    // On rotation, points at the token that replaced this one.
    replacedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RefreshToken',
      default: null,
    },
  },
  { timestamps: true }
);

// Let MongoDB reap expired rows automatically once they pass expiresAt.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);