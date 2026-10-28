-- P3-05a. Runs before the generated tables (Prisma defaults call nextval on the sequence; User.email uses citext).
-- Safe to re-run: every statement is IF NOT EXISTS.

-- module 19 delta 19-8: case-insensitive e-mail
CREATE EXTENSION IF NOT EXISTS citext;

-- global public id sequence (10 digit ids, shared by every PID table), data-model Appendix B
CREATE SEQUENCE IF NOT EXISTS entity_public_id_seq START 5100000001;

-- Column default for PID tables. Prisma reads a bare nextval('seq') default as a sequence it owns and then proposes
-- to drop the shared sequence on the next "migrate dev". A function default is read back unchanged, so no drift.
CREATE OR REPLACE FUNCTION next_public_id() RETURNS bigint
LANGUAGE sql VOLATILE AS $$ SELECT nextval('entity_public_id_seq') $$;
