import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './drizzle/schema';

const connectionString = process.env.DATABASE_URL!;

// Disable prefetch as it is not supported for "Transaction" pool mode
const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });

// Helper functions
export async function getWorkers() {
  return client.select().from(schema.workers);
}

export async function getJobs(limit = 50) {
  return client.select().from(schema.jobs)
    .orderBy(schema.jobs.postedAt)
    .limit(limit);
}
