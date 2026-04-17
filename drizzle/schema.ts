import { pgTable, uuid, text, integer, real, boolean, timestamp, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  phone: text('phone').unique(),
  name: text('name'),
  role: text('role'), // 'worker' or 'client'
  skills: jsonb('skills'),
  district: text('district'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const workers = pgTable('workers', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  skill: text('skill').notNull(),
  rating: real('rating').default(0),
  jobsCount: integer('jobs_count').default(0),
  phone: text('phone').unique(),
  district: text('district'),
  verified: boolean('verified').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const jobs = pgTable('jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  district: text('district').notNull(),
  category: text('category').notNull(),
  priceMin: integer('price_min'),
  priceMax: integer('price_max'),
  views: integer('views').default(0),
  applicants: integer('applicants').default(0),
  status: text('status').default('open'), // 'open', 'in_progress', 'completed'
  postedAt: timestamp('posted_at').defaultNow(),
  clientId: uuid('client_id').references(() => users.id),
});

export const applications = pgTable('applications', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: uuid('job_id').references(() => jobs.id),
  workerId: uuid('worker_id').references(() => workers.id),
  userId: uuid('user_id').references(() => users.id),
  status: text('status').default('pending'), // 'pending', 'accepted', 'rejected'
  appliedAt: timestamp('applied_at').defaultNow(),
});

export const savedJobs = pgTable('saved_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  jobId: uuid('job_id').references(() => jobs.id),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueUserJob: uniqueIndex('unique_user_job').on(table.userId, table.jobId),
}));

export const jobAlerts = pgTable('job_alerts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  category: text('category'),
  district: text('district'),
  createdAt: timestamp('created_at').defaultNow(),
});
