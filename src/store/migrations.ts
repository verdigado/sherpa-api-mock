/**
 * Schema changes, applied in order. The database stores how many it has run,
 * so each one runs once and existing data survives. Never edit one that has
 * shipped; add a new one instead.
 */
export const MIGRATIONS = [
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    personal_id TEXT NOT NULL,
    name1 TEXT NOT NULL,
    name2 TEXT NOT NULL,
    email TEXT,
    owner_id TEXT NOT NULL,
    owner_identifier TEXT NOT NULL,
    created_on TEXT NOT NULL,
    last_modified_on TEXT NOT NULL,
    achievements TEXT,
    form_values TEXT NOT NULL
  );
  CREATE TABLE memberships (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users ON DELETE CASCADE,
    owner_identifier TEXT NOT NULL,
    member_of_structure_identifier TEXT NOT NULL,
    joined_at TEXT NOT NULL,
    exited_at TEXT
  );
  CREATE TABLE role_assignments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users ON DELETE CASCADE,
    owner_identifier TEXT NOT NULL,
    role_id TEXT NOT NULL,
    delegated_by_organization_identifier TEXT,
    tags TEXT
  );
  CREATE TABLE profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users ON DELETE CASCADE,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    login_email TEXT,
    privacy TEXT NOT NULL,
    image TEXT NOT NULL,
    phone_numbers TEXT NOT NULL,
    messengers TEXT NOT NULL,
    social_media TEXT NOT NULL,
    tags TEXT
  );
  CREATE TABLE sequences (
    name TEXT PRIMARY KEY,
    value INTEGER NOT NULL
  );
  -- ids for phone numbers, messengers, social media and images added through the API
  INSERT INTO sequences (name, value) VALUES ('profile_item', 1000000);
  `,
  `
  ALTER TABLE role_assignments ADD COLUMN expires_on TEXT;
  -- above the ids in the fixtures
  INSERT INTO sequences (name, value) VALUES ('user', 200000);
  INSERT INTO sequences (name, value) VALUES ('role_assignment', 1000000);
  `,
]
