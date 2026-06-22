// HTTP layer for auth. Sets the refresh token as an httpOnly cookie; returns
// the access token + sanitized user in the body.
const asyncHandler = require('../../utils/asyncHandler');
const authService = require('./auth.service');
const config = require('../../config/env');

const REFRESH_TTL_MS = config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000;

function setRefreshCookie(res, raw) {
  res.cookie(config.cookie.name, raw, {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    path: config.cookie.path,
    maxAge: REFRESH_TTL_MS,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(config.cookie.name, { path: config.cookie.path });
}

// access-token lifetime in seconds, for the client's proactive refresh
function accessExpiresIn() {
  const ttl = config.jwt.accessTtl; // "15m"
  const m = /^(\d+)m$/.exec(ttl);
  if (m) return parseInt(m[1], 10) * 60;
  const s = /^(\d+)s$/.exec(ttl);
  if (s) return parseInt(s[1], 10);
  return 900;
}

const register = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshRaw } = await authService.register(req.body);
  setRefreshCookie(res, refreshRaw);
  res.status(201).json({
    success: true,
    data: {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: accessExpiresIn(),
      user, // toJSON transform strips passwordHash/tokenVersion/__v
    },
  });
});

const login = asyncHandler(async (req, res) => {
  const { accessToken, refreshRaw } = await authService.login(req.body);
  setRefreshCookie(res, refreshRaw);
  res.json({
    success: true,
    data: {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: accessExpiresIn(),
    },
  });
});

// Reads refresh token from the cookie, rotates it.
const refresh = asyncHandler(async (req, res) => {
  const refreshRaw = req.cookies?.[config.cookie.name];
  const result = await authService.refresh({ refreshRaw });
  setRefreshCookie(res, result.refreshRaw);
  res.json({
    success: true,
    data: {
      accessToken: result.accessToken,
      tokenType: 'Bearer',
      expiresIn: accessExpiresIn(),
      user: result.user,
    },
  });
});

const logout = asyncHandler(async (req, res) => {
  const refreshRaw = req.cookies?.[config.cookie.name];
  await authService.logout({
    refreshRaw,
    accessJti: req.auth?.jti,
    accessExp: req.auth?.exp,
  });
  clearRefreshCookie(res);
  res.json({ success: true, message: 'Logged out' });
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.auth.userId);
  res.json({ success: true, data: user });
});

const logoutAll = asyncHandler(async (req, res) => {
  await authService.logoutAll(req.auth.userId);
  clearRefreshCookie(res);
  res.json({ success: true, message: 'Logged out of all sessions' });
});

module.exports = { register, login, refresh, logout, me, logoutAll };