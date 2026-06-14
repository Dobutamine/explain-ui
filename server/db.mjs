// Lazy singleton MongoDB connection, shared by the dev (vite.config.ts) and prod
// (server/index.mjs) auth endpoints. The connection string lives in MONGODB_URI
// (see .env.local) and INCLUDES the database name in its path, so db() with no
// argument resolves to the right database (e.g. `explain`). The MongoClient is
// cached across requests — connecting per request would exhaust the pool.

import { MongoClient } from "mongodb";

// Collection holding login credentials. Schema (confirmed against the live DB):
// { email: string, password: <bcrypt hash>, name, admin, institution, ... }.
const USERS_COLLECTION = "users";

let clientPromise = null;

function getClient() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set");
  // Cache the connect() promise so concurrent callers share one handshake.
  if (!clientPromise) {
    const client = new MongoClient(uri);
    clientPromise = client.connect().catch((e) => {
      // Reset so a later request can retry instead of reusing a rejected promise.
      clientPromise = null;
      throw e;
    });
  }
  return clientPromise;
}

export async function getUsersCollection() {
  const client = await getClient();
  return client.db().collection(USERS_COLLECTION);
}

// Collection holding user-saved model states (full reloadable scenario docs,
// one per save, scoped to an owner). See server/states.mjs.
const STATES_COLLECTION = "states";

export async function getStatesCollection() {
  const client = await getClient();
  return client.db().collection(STATES_COLLECTION);
}
