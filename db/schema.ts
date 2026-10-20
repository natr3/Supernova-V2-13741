import type { Preferences } from '../lib/preferences.js';
import { pgTable, serial, text, timestamp, uniqueIndex, jsonb } from 'drizzle-orm/pg-core';

export const entries = pgTable('entries', {
  id: serial().primaryKey(),
  title: text().notNull(),
  url: text().notNull(),
  kind: text().notNull().default('game'),
  visibility: text().notNull().default('public'),
  ownerId: text('owner_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const favorites = pgTable('favorites', {
  id: serial().primaryKey(),
  userId: text('user_id').notNull(),
  itemKey: text('item_key').notNull(),
}, (table) => [uniqueIndex('favorites_user_item').on(table.userId, table.itemKey)]);

export const profiles = pgTable('profiles', {
  userId: text('user_id').primaryKey(),
  notes: text().notNull().default(''),
  settings: jsonb().$type<Preferences>().notNull().default({}),
});
