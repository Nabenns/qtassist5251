const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const BCRYPT_ROUNDS = 10;
const TOKEN_TTL = '24h';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET environment variable must be set and at least 32 characters long.'
    );
  }
  return secret;
}

function getCookieName() {
  return process.env.SESSION_COOKIE_NAME || 'qtassist_session';
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

async function verifyPassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

function signToken(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: TOKEN_TTL });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (error) {
    return null;
  }
}

/**
 * Set the auth cookie on the response.
 */
function setAuthCookie(res, token) {
  res.cookie(getCookieName(), token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24h
  });
}

function clearAuthCookie(res) {
  res.clearCookie(getCookieName(), {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'strict'
  });
}

function readAuthCookie(req) {
  return req.cookies && req.cookies[getCookieName()];
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  setAuthCookie,
  clearAuthCookie,
  readAuthCookie
};
