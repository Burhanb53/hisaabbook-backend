const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const RefreshToken = require('../models/RefreshToken');

const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 30;

const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');

exports.signAccessToken = (user) =>
  jwt.sign(
    { sub: user._id.toString(), tenant: user.tenant.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TTL }
  );

exports.verifyAccessToken = (token) => jwt.verify(token, process.env.JWT_SECRET);

exports.issueRefreshToken = async (user, device) => {
  const token = crypto.randomBytes(48).toString('hex');
  await RefreshToken.create({
    user: user._id,
    token_hash: hash(token),
    expires_at: new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
    device
  });
  return token;
};

// Single-use: a refresh token is consumed when exchanged (rotation).
exports.consumeRefreshToken = async (token) =>
  RefreshToken.findOneAndDelete({ token_hash: hash(token), expires_at: { $gt: new Date() } });

exports.revokeRefreshToken = (token) => RefreshToken.deleteOne({ token_hash: hash(token) });
exports.revokeAllForUser = (userId) => RefreshToken.deleteMany({ user: userId });
