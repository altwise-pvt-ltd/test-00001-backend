// Access-token blacklist. Access tokens are short-lived and stateless, but on an
// explicit logout we still want to kill the *current* access token before its
// natural expiry. We store its `jti` (a per-token uuid) until `expiresAt`, which
// requireAuth checks on every request. A TTL index drops rows once the token
// would have expired anyway, keeping the collection small.
const mongoose = require('mongoose');

const blacklistedTokenSchema = new mongoose.Schema(
  {
    jti: {
      type: String,
      required: true,
      unique: true,
    },

    // The access token's own expiry — once past, the entry is useless and reaped.
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

blacklistedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('BlacklistedToken', blacklistedTokenSchema);