// Transport-agnostic auth handlers, shared by the dev (vite.config.ts) and prod
// (server/index.mjs) wrappers. Each returns { status, body, setCookie? } so the
// caller only has to write the HTTP response — no Express/Connect coupling.

import bcrypt from "bcryptjs";
import { getUsersCollection } from "./db.mjs";
import { seedDefaultState } from "./states.mjs";
import {
  signSession,
  verifySession,
  parseCookies,
  sessionCookie,
  clearCookie,
  COOKIE_NAME,
} from "./session.mjs";

/**
 * @typedef {{ status: number, body: any, setCookie?: string }} AuthResult
 */

// Fields safe to expose to the browser (never the password hash / _id internals).
function publicUser(doc) {
  return {
    email: doc.email,
    name: doc.name ?? "",
    admin: !!doc.admin,
    institution: doc.institution ?? "",
    modelDeveloper: !!doc.modelDeveloper,
    defaultState: doc.defaultState ?? null,
    defaultLocalState: doc.defaultLocalState ?? null,
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
const BCRYPT_ROUNDS = 10;

// POST /api/auth/register { name, email, institution, password }
// Open self-registration: creates a non-admin user and signs them in (sets the
// session cookie) on success — same shape as login so the client lands logged in.
/** @returns {Promise<AuthResult>} */
export async function register(
  { name, email, institution, password } = {},
  { secure = false } = {},
) {
  const bad = (msg) => ({ status: 400, body: { error: msg } });
  const nm = typeof name === "string" ? name.trim() : "";
  const em = typeof email === "string" ? email.trim().toLowerCase() : "";
  const inst = typeof institution === "string" ? institution.trim() : "";
  const pw = typeof password === "string" ? password : "";

  if (!nm) return bad("name is required");
  if (!EMAIL_RE.test(em)) return bad("a valid email is required");
  if (pw.length < MIN_PASSWORD) return bad(`password must be at least ${MIN_PASSWORD} characters`);

  const users = await getUsersCollection();
  // Case-insensitive duplicate check (matches login's lookup).
  const safe = em.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const existing = await users.findOne({ email: { $regex: `^${safe}$`, $options: "i" } });
  if (existing) return { status: 409, body: { error: "an account with this email already exists" } };

  const hash = await bcrypt.hash(pw, BCRYPT_ROUNDS);
  const doc = {
    name: nm,
    email: em,
    institution: inst,
    password: hash,
    admin: false,
    modelDeveloper: false,
    defaultState: null,
    defaultLocalState: null,
  };
  try {
    const result = await users.insertOne(doc);
    // Seed the new user's default state from the bundled term_neonate definition
    // and point defaultState at it. Best-effort: a failure here must not break
    // registration, so we log and continue without a default.
    try {
      const stateId = await seedDefaultState({ email: em, name: nm });
      if (stateId) {
        await users.updateOne({ _id: result.insertedId }, { $set: { defaultState: stateId } });
        doc.defaultState = stateId;
      }
    } catch (seedErr) {
      console.error("seedDefaultState failed for", em, "-", String(seedErr));
    }
    const token = signSession({ sub: String(result.insertedId), email: em });
    return {
      status: 201,
      body: { user: publicUser(doc) },
      setCookie: sessionCookie(token, { secure }),
    };
  } catch (e) {
    // Unique-index collision (if one exists on email) → treat as duplicate.
    if (e && e.code === 11000) {
      return { status: 409, body: { error: "an account with this email already exists" } };
    }
    throw e;
  }
}

// POST /api/auth/login { email, password }
/** @returns {Promise<AuthResult>} */
export async function login({ email, password } = {}, { secure = false } = {}) {
  const invalid = { status: 401, body: { error: "invalid email or password" } };
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return invalid;
  }
  const users = await getUsersCollection();
  // Case-insensitive email match; emails are stored lower-cased in practice but
  // be forgiving on input. Anchored exact match, escaping regex metachars.
  const safe = email.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const user = await users.findOne({ email: { $regex: `^${safe}$`, $options: "i" } });
  if (!user || typeof user.password !== "string") return invalid;
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return invalid;

  const token = signSession({ sub: String(user._id), email: user.email });
  return {
    status: 200,
    body: { user: publicUser(user) },
    setCookie: sessionCookie(token, { secure }),
  };
}

// GET /api/auth/me — hydrate the session from the cookie.
/** @returns {Promise<AuthResult>} */
export async function me(cookieHeader) {
  const token = parseCookies(cookieHeader)[COOKIE_NAME];
  const payload = verifySession(token);
  if (!payload) return { status: 401, body: { error: "not authenticated" } };
  // Re-read from the DB so a deleted/edited user can't ride a stale token.
  const users = await getUsersCollection();
  const user = await users.findOne({ email: payload.email });
  if (!user) return { status: 401, body: { error: "not authenticated" } };
  return { status: 200, body: { user: publicUser(user) } };
}

// POST /api/auth/logout — clear the cookie.
/** @returns {AuthResult} */
export function logout({ secure = false } = {}) {
  return { status: 200, body: { ok: true }, setCookie: clearCookie({ secure }) };
}

// --- Admin-only endpoints ---------------------------------------------------

// Resolve the caller and require admin rights. Returns the user doc, or a
// { status, body } error object the caller should return as-is.
async function requireAdmin(cookieHeader) {
  const payload = verifySession(parseCookies(cookieHeader)[COOKIE_NAME]);
  if (!payload) return { error: { status: 401, body: { error: "not authenticated" } } };
  const users = await getUsersCollection();
  const user = await users.findOne({ email: payload.email });
  if (!user) return { error: { status: 401, body: { error: "not authenticated" } } };
  if (!user.admin) return { error: { status: 403, body: { error: "admin only" } } };
  return { user, users };
}

// GET /api/auth/users — admin: list all users (public fields only).
/** @returns {Promise<AuthResult>} */
export async function listUsers(cookieHeader) {
  const ctx = await requireAdmin(cookieHeader);
  if (ctx.error) return ctx.error;
  const docs = await ctx.users.find({}, { projection: { password: 0 } }).toArray();
  return { status: 200, body: { users: docs.map(publicUser) } };
}

// POST /api/auth/set-model-developer { email, modelDeveloper } — admin: flip a
// user's model-developer flag.
/** @returns {Promise<AuthResult>} */
export async function setModelDeveloper(cookieHeader, { email, modelDeveloper } = {}) {
  const ctx = await requireAdmin(cookieHeader);
  if (ctx.error) return ctx.error;
  const em = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!em) return { status: 400, body: { error: "email is required" } };
  const safe = em.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const result = await ctx.users.findOneAndUpdate(
    { email: { $regex: `^${safe}$`, $options: "i" } },
    { $set: { modelDeveloper: !!modelDeveloper } },
    { returnDocument: "after" },
  );
  const doc = result?.value ?? result;
  if (!doc) return { status: 404, body: { error: "user not found" } };
  return { status: 200, body: { user: publicUser(doc) } };
}
