// Resolves the school a request targets and attaches it as req.schoolId.
//
// Subjects/classes/sections are managed by BOTH a principal (their OWN school)
// and the super-admin (any school, targeted explicitly). The two differ only in
// where the schoolId comes from:
//   - super-admin : has no school of their own, so they MUST target one via the
//                   nested route param (/api/schools/:schoolId/subjects). Missing
//                   param -> 400.
//   - everyone else: the schoolId comes from their verified token (req.auth),
//                   and any :schoolId param is IGNORED — a principal can never
//                   act on another school (tenant fence stays intact).
//
// Runs AFTER requireAuth (it relies on req.auth). The service still verifies the
// targeted school exists and is not soft-deleted before mutating.
const ApiError = require('../utils/ApiError');
const { USER_ROLES } = require('../constant/constant');

function resolveSchoolScope(req, res, next) {
  if (!req.auth) {
    return next(ApiError.unauthorized('Authentication required'));
  }

  if (req.auth.role === USER_ROLES.SUPER_ADMIN) {
    if (!req.params.schoolId) {
      return next(
        ApiError.badRequest('Admin must target a school: use /api/schools/:schoolId/<resource>')
      );
    }
    req.schoolId = req.params.schoolId;
  } else {
    // tenant fence: ignore any param, always use the caller's own school
    req.schoolId = req.auth.schoolId;
  }

  next();
}

module.exports = resolveSchoolScope;
