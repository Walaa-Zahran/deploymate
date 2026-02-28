<!-- docker-compose.dev.yml -->
docker-compose.dev.yml is my local “mini cloud” file.

It lets you start the backend services my app depends on (Postgres + Redis) with one command, so my API/worker can run on my laptop exactly like they will on DigitalOcean.

What it does in this project

PostgreSQL container

my database for: users, projects, job runs, generated outputs metadata

Redis container

used by BullMQ as a job queue (API pushes jobs → worker consumes jobs)

Why it’s important (practically)

Fast setup

Instead of installing Postgres + Redis manually on my machine and configuring them, you run:

docker compose -f docker-compose.dev.yml up -d

Same environment for everyone

If a teammate runs my project, they get the same DB + Redis versions and config.

Reproducible + less “it works on my machine”

You avoid differences between laptops (Windows/Mac/Linux) and versions.

Persistent data

The volumes: section keeps my DB data even if containers restart.

Without volumes, every restart would wipe the database.

Matches production architecture

In production you’ll use Managed Postgres and Managed Redis on DigitalOcean.

Locally, Compose gives you the same idea but as containers.

What happens if you don’t use it?

You’d need to:

install Postgres + Redis manually

keep them running

create DB/users

debug connection issues

deal with version mismatches

Compose removes all that friction.


What is Redis?

Redis is an in-memory data store.

Think of it as:

A super fast temporary data storage that lives in RAM.

Unlike PostgreSQL:

PostgreSQL = permanent structured storage (tables, relations)

Redis = very fast temporary storage

Why is Redis so fast?

Because:

It stores everything in memory (RAM)

Not on disk like traditional databases

That makes it:

Extremely fast

Perfect for short-lived data

What is Redis used for?

Common uses:

Caching

Sessions

Real-time counters

Pub/Sub

Job queues ← this is what we use

Why We Need Redis in DeployMate

my system has:

API (receives request)

Worker (does heavy processing like AI + repo analysis)

We don’t want:

User → API → wait 30 seconds while AI runs

That would freeze the request.

Instead we do this:

User → API
API → put job in queue (Redis)
Worker → picks job → processes
Worker → saves result
Frontend → polls status

Redis is the middleman between API and Worker.

Visual Example

Without Redis:

User clicks "Analyze"
API starts AI call
User waits 30 seconds
Request times out 😅

With Redis:

User clicks "Analyze"
API puts job in Redis queue (instant)
API responds: "Job started"

Worker sees job in Redis
Worker processes it
Worker saves result
Frontend gets result

Smooth. Scalable. Clean.

So What Is a Queue?

Imagine Redis like a line in a bank:

Job 1
Job 2
Job 3

Worker stands there and processes:

Takes Job 1

Finishes

Takes Job 2

Finishes

That’s it.

Why Not Use PostgreSQL for Jobs?

Because:

It’s slower

Not built for high-speed job processing

Doesn’t handle queue patterns as cleanly

Redis is optimized for:

pushing jobs

popping jobs

pub/sub messaging

Postgres stores official documents.

Redis sends fast messages between services.


In Our Architecture

Redis will:

Hold job data temporarily

Notify worker immediately

Handle concurrency safely

Allow retries if job fails

And BullMQ (our library) will use Redis under the hood.

One Important Thing

Redis is not my main database.

It’s:

Fast

Temporary

Meant for coordination

Postgres is still my main source of truth.

<!-- .env.example -->
This keeps config consistent across api/worker.
<!-- docker compose -f docker-compose.dev.yml up -d -->
Breakdown:

docker compose → Uses Docker Compose (v2 syntax).

-f docker-compose.dev.yml → Specifies the compose file to use (my dev config instead of default docker-compose.yml).

up → Builds (if needed) and starts the containers.

-d → Runs in detached mode (in the background).

✅ What Should Happen

If everything is correct:

Docker will build images (if not built).

Containers will start.

You’ll get container IDs printed.

my services (API, DB, etc.) will be running in background.

<!-- the API skeleton (Express + TypeScript) -->

I'll create a small clean API:

/health endpoint (required for DO health checks)

config loader

basic error handling
<!-- apps/api/package.json -->
Why these packages

express fast API

dotenv loads env vars

zod validates env vars (prevents silent bugs)

tsx runs TS directly in dev
<!-- apps/api/tsconfig.json -->
<!-- apps/api/src/config/env.ts -->
If env is missing, I fail immediately with a clear error.
<!-- apps/api/src/app.ts -->
<!-- apps/api/src/main.ts -->
That file (apps/api/src/app.ts) exists to separate “building the Express app” from “starting the server”.

Why we don’t put everything in main.ts

Because main.ts should only do one thing:

read env

create the app

start listening on a port

If you mix routes, middleware, error handlers, DB init, queue init, etc. inside main.ts, it becomes messy fast.

What app.ts is responsible for

It returns a fully configured Express instance:

1) Middleware setup
app.use(cors(...))
app.use(express.json(...))

So every request:

is allowed from your Angular domain (API_CORS_ORIGIN)

can send JSON bodies up to 2MB (good for repo metadata / prompts later)

2) Health endpoint
app.get("/health", ...)

DigitalOcean (and you) can ping this to know the service is alive.
Also useful later for monitoring / readiness checks.

3) 404 handler
app.use((_req, res) => res.status(404)...)

If someone hits /unknown, they get clean JSON.

4) Error handler
app.use((err, _req, res, _next) => ...)

This catches thrown errors from routes/middleware and returns a consistent response, instead of crashing or leaking stack traces.

What main.ts is responsible for

Only starting the server:

const app = createApp();
app.listen(env.API_PORT, ...)

That separation makes it easy to:

unit test createApp() later

reuse the app in integration tests

keep startup logic clean

One important note (ordering)

Your error handler only catches errors if a route calls next(err) or throws inside async handlers properly. Later we’ll add an asyncHandler wrapper or use a small helper to ensure async errors get caught.

<!-- apps/api/.env -->