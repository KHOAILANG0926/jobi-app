# Canonical location cutover

`00-preview.sql` is read-only and must be reviewed before `10-apply.sql`. Only the
root operator applies the exact reviewed SQL in one migration transaction. No
production DDL/DML was executed while authoring these files. Never run the local
fixtures against a remote database.

Run isolated integration with:

```sh
bash supabase/pending/location-single-source-20261026/production/run-local.sh
```

The runner uses only the local Docker socket and creates/removes its own
PostgreSQL 17/PostGIS container. It accepts no connection URL. The captured
schema fixture contains every production column, generated PostGIS expression,
and scoped CHECK/PK/UNIQUE/FK constraints for the seven touched tables. Real
location auth/normalization/claim/reserve/budget helper bodies were read from
production with read-only metadata queries. Fixture data is synthetic and uses
`RETURNING` IDs. The migration runs as a dedicated NOSUPERUSER/CREATEROLE operator owning the scoped fixture objects, matching managed Supabase privileges.

The fixture deliberately excludes unrelated publication/occupation/signal hooks,
external `pg_net`/Vault delivery (the actual request helper uses local recording stubs), and FKs into unrelated feature tables. Auth JWT
reads and account status are local fixtures; `require_admin` and owner/token
checking use production bodies. Therefore this is a real scoped PostgreSQL/RLS/
PostGIS integration suite, **not** a full production database restore or a claim
that production browser flows have been exercised. The root task owns live
read-only preview, browser E2E, deployment and production postconditions.

Source row mutations pass through the single private `write_location` function,
owned by a NOLOGIN/NOBYPASSRLS role. The temporary SET-enabled membership and schema
CREATE grant required for ownership transfer are revoked in the transaction.
PostgreSQL 17 may retain its automatic trusted creator ADMIN-only membership
with INHERIT=false and SET=false. No application role may be a direct/transitive
member or execute the private writer; transaction postconditions check both.
The table guard checks the execution role, never a caller-controlled GUC.
Metadata uses a fixed whitelist, batch replacement preserves matching IDs and
human decisions, and removed source rows are retained privately. Public evidence
contains sanitized source/timestamp/confirmation IDs; raw request evidence and
original provider responses stay private.

Every touched mutation acquires the same transaction advisory gate before row
locks. This deliberately serializes short database mutations, including existing
queue claims/reservations and parent-identity trigger fanout. It does not hold a
lock across provider HTTP requests. A lexical scanner locates the executable
PL/pgSQL BEGIN, skipping nested comments and quoted literals; patching asserts
that existing function ACL/security/config/volatility remain unchanged. This
conservative gate is a throughput tradeoff; replace it only with a separately
reviewed concurrency design, not ad hoc lock-order changes.

Preview and completion share these provider-target rules: use a valid explicit
address; otherwise use the sole source target; if no source exists, use the real
parent address; if several targets exist without an explicit address, fail and
roll back. Existing unverified coordinates become `area`, retain the original
row timestamp as imported evidence, and are never promoted to verified. Source
and provider snapshots remain retained; existing queue state/lease/call budget
and publication flags are postasserted unchanged during migration.

Verification includes pre-DDL missing/conflicting-evidence rollback, post-DDL
missing-cache-evidence rollback, legacy imports, same-company/address/diacritic
isolation, real-role write/call denial, spoofed GUC denial, owner pins, multi-site
sets, stale lease/snapshot rejection, newest human priority, revoke/delete/
company/address invalidation, retained deletions, missing-cache detection, and
five real two-session races. Rule rows do not assert live test success.

Rollback before COMMIT is automatic on any assertion or SQL error. After commit,
do not blindly replay old coordinates: use the retained private rows/original
migration history to prepare a reviewed inverse migration that reconciles any
subsequent human decisions. This package performs no irreversible row deletion.
