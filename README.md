<!-- Step 1 — Local Dev Infrastructure (docker-compose) -->
<!-- docker-compose.dev.yml -->
docker-compose.dev.yml is my local “mini cloud” file.

It lets i start the backend services my app depends on (Postgres + Redis) with one command, so my API/worker can run on my laptop exactly like they will on DigitalOcean.

What it does in this project

PostgreSQL container

my database for: users, projects, job runs, generated outputs metadata

Redis container

used by BullMQ as a job queue (API pushes jobs → worker consumes jobs)

Why it’s important (practically)

Fast setup

Instead of installing Postgres + Redis manually on my machine and configuring them, i run:

docker compose -f docker-compose.dev.yml up -d

Same environment for everyone

If a teammate runs my project, they get the same DB + Redis versions and config.

Reproducible + less “it works on my machine”

I avoid differences between laptops (Windows/Mac/Linux) and versions.

Persistent data

The volumes: section keeps my DB data even if containers restart.

Without volumes, every restart would wipe the database.

Matches production architecture

In production i'll use Managed Postgres and Managed Redis on DigitalOcean.

Locally, Compose gives i the same idea but as containers.

What happens if i don’t use it?

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

Job queues ← this is what i use

Why I Need Redis in DeployMate

my system has:

API (receives request)

Worker (does heavy processing like AI + repo analysis)

I don’t want:

User → API → wait 30 seconds while AI runs

That would freeze the request.

Instead i do this:

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

 What Should Happen

If everything is correct:

Docker will build images (if not built).

Containers will start.

I'll get container IDs printed.

my services (API, DB, etc.) will be running in background.

<!-- the API skeleton (Express + TypeScript) -->

I'll create a small clean API:

/health endpoint (required for DO health checks)

config loader

basic error handling

<!--Step 2 : Build the API skeleton (Express + TypeScript) -->

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

Why i don’t put everything in main.ts

Because main.ts should only do one thing:

read env

create the app

start listening on a port

If i mix routes, middleware, error handlers, DB init, queue init, etc. inside main.ts, it becomes messy fast.

What app.ts is responsible for

It returns a fully configured Express instance:

1) Middleware setup
app.use(cors(...))
app.use(express.json(...))

So every request:

is allowed from my Angular domain (API_CORS_ORIGIN)

can send JSON bodies up to 2MB (good for repo metadata / prompts later)

2) Health endpoint
app.get("/health", ...)

DigitalOcean (and i) can ping this to know the service is alive.
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

My error handler only catches errors if a route calls next(err) or throws inside async handlers properly. Later we’ll add an asyncHandler wrapper or use a small helper to ensure async errors get caught.

<!-- apps/api/.env -->
apps/api/.env is just a local-development convenience file so the API can start with the right environment variables without i typing/exporting them every time.

Why you’d have it

When i run:

npm run dev

the API reads env vars (via dotenv/config in env.ts). If i don’t provide them somewhere, things like DATABASE_URL and REDIS_URL won’t exist and the server will fail.

So .env is a simple way to store:

API_PORT

DATABASE_URL

REDIS_URL

secrets like API_JWT_SECRET

Why in apps/api/ specifically

Because it scopes config to that service. In a monorepo i'll likely have different .env files:

apps/api/.env (API settings)

apps/worker/.env (Worker settings)

apps/web/.env (Frontend env settings if needed)

This avoids mixing everything in one place.
<!--worker folder-->
the worker is a separate backend process whose job is to do heavy / slow tasks in the background, instead of making the API wait.

Why i need a worker

If my API tries to do everything inside the request:

cloning a repo

scanning many files

calling an LLM (can take seconds)

generating/exporting files

uploading to Spaces

…then the API request becomes slow, can timeout, and the UI feels laggy.

So i split responsibilities:

What the worker folder means

apps/worker is a separate service (a separate Node app) that:

listens to a queue (Redis via BullMQ)

picks up jobs that the API enqueues

runs the heavy logic

returns results (and later i'll store them in DB/Spaces)

Simple flow

User clicks “Analyze Repo” in UI

API receives request and immediately responds with jobId

API pushes a job to Redis queue

Worker consumes that job and does the heavy work

UI checks job status until it’s done

What tasks should go in the worker (DeployMate examples)

Repo ingestion

download ZIP from GitHub

or shallow clone

read key files: package.json, angular.json, requirements.txt, Dockerfile, etc.

Stack detection

decide: Angular? React? Node? Python? .NET?

detect build commands, start commands

AI generation

generate Dockerfile

generate GitHub Actions pipeline

generate DigitalOcean App Spec YAML

generate deployment steps

Export

create a ZIP containing all generated files

upload to DigitalOcean Spaces

What stays in the API (fast things)

auth (JWT)

saving/reading “projects”

creating jobs

returning job status + results to frontend

Think of it like this

API = receptionist (fast, answers immediately)

Worker = engineer in the back doing the real work

Both run separately on DigitalOcean:

api is a Web Service

worker is also a Web Service (or “worker service”) that runs continuously
<!-- apps/worker/package.json -->
Why:

bullmq = queue + worker framework

ioredis = Redis driver BullMQ uses

dotenv + zod = same config safety as API

<!-- apps/worker/.env -->
apps/worker/.env is there so the worker can run independently with the right configuration (mainly REDIS_URL) without i hardcoding anything in code.

What it does

When the worker starts, this line in apps/worker/src/config/env.ts loads environment variables:

import "dotenv/config";

So the worker reads:

REDIS_URL=redis://localhost:6379

Then it connects BullMQ to the correct Redis instance.

Why i want it (especially in a monorepo)

API and Worker are separate processes. Each one needs its own config.

In production (DigitalOcean), i won’t use .env files; i'll set env vars in App Platform.
But locally, .env is the fastest way to run each service.

Do i have to keep it?

No. Fast options:

Option A (keep it) — simplest

Each service has its own .env.

Run from its folder, it “just works”.

Option B (single root .env)

I can delete apps/worker/.env and set REDIS_URL globally in my shell or use root tooling.

But then i must ensure the worker process sees that env var.

Best practice

Keep .env.example committed.

Keep .env NOT committed (add it to .gitignore).
<!-- apps/worker/src/config/env.ts -->

Because the worker is a separate program from the API, and it also needs configuration (at least REDIS_URL). apps/worker/src/config/env.ts gives i three important benefits:

Loads environment variables (dotenv/config) so the worker can run locally with apps/worker/.env.

Validates required config at startup (zod) so i fail fast with a clear error instead of silent “worker not processing jobs”.

Centralizes config so every worker file imports env.REDIS_URL from one place (clean + scalable when i add more vars like DATABASE_URL, SPACES_*, OPENAI_API_KEY, etc.).

What would happen without it?

You’d do things like:

const redisUrl = process.env.REDIS_URL;

If i forget to set it, redisUrl becomes undefined and i get confusing Redis/BullMQ errors (or it connects to the wrong place).

Why is it separate from the API env file?

Even if both use Redis, they’re different services:

In DigitalOcean they run as separate App Platform components

They can have different env vars

I want the worker to boot independently

<!-- apps/worker/src/queue/queues.ts -->

Why: one source of truth for queue names.
<!-- apps/worker/src/queue/worker.ts -->
<!-- apps/worker/src/main.ts -->
Because we’re separating “bootstrapping the app” from “running queue workers”.

What each file does

apps/worker/src/main.ts

The entry point (the thing Node runs).

Should stay tiny: load config → start the app.

apps/worker/src/queue/worker.ts

Contains the actual BullMQ Worker setup:

which queue to listen to (repo-analysis)

how to process jobs (the handler function)

event listeners (completed, failed)

Redis connection config

Why this separation is useful (even in hackathon speed)

Scales cleanly when i add more queues

Today: repo-analysis

Tomorrow: generate-docker, generate-cicd, export-zip

I'll just add more worker instances in startWorkers() without turning main.ts into a mess.

Easier testing and reuse

I can import startWorkers() in tests or different runtime setups.

Clear mental model

main.ts = “start the service”

queue/worker.ts = “job processing logic”

<!--Step 3 -- Worker skeleton + BullMQ queue -->

Goal of this step

 API can enqueue a job to Redis
 Worker consumes the job and logs it
 You can test it with one HTTP request
<!-- 3.1 Install BullMQ + Redis client in API and Worker -->

In apps/api:
npm i bullmq ioredis

In apps/worker create package.json, tsconfig.json

<!-- 3.2 Add shared env config in Worker apps/worker/src/config/env.ts apps/worker/.env-->
<!-- 3.3 Define queue names  apps/worker/src/queue/names.ts-->
<!-- 3.4 Create the worker process apps/worker/src/queue/worker.ts-->

<!-- Step 4 — API can enqueue a job (end-to-end test) -->

<!-- 4.1 Add queue names in API apps/api/src/queue/names.ts-->

<!-- 4.2 Add queue setup in API  apps/api/src/queue/queues.ts-->

<!-- 4.3 Add an endpoint to enqueue jobs apps/api/src/modules/analysis/analysis.routes.ts-->
wire this router into the app.
Edit: apps/api/src/app.ts
So my API now has:

GET /health

POST /analysis/repo

<!-- Step 5: Database (Prisma) + persistent Project/Run tracking -->
so my API/Worker stop being “logs only” and become a real product.

<!-- 5.1 Install Prisma in apps/api -->
<!-- 5.2 Define DB models apps/api/prisma/schema.prisma -->

Why this design

Project = one repo URL

AnalysisRun = each time you click “Analyze”

result is JSON so we can evolve quickly (hackathon-friendly)

<!-- 5.3 Run migration + generate client -->
<!-- 5.4 Add Prisma client singleton apps/api/src/db/prisma.ts-->
<!-- 5.5 Update API: create a Project + Run, then enqueue job with runId -->
add an endpoint:

POST /analysis/repo creates/gets Project, creates Run(QUEUED), enqueues job with runId

GET /analysis/runs/:runId returns status + result

<!-- Step 6 — Worker writes RUNNING/DONE/FAILED back to Postgres -->

<!-- 6.1 Install Prisma in Worker 
<!-- 6.2 Copy Prisma schema to worker -->
<!-- 6.3 Add worker Prisma client apps/worker/src/db/prisma.ts-->
<!-- 6.4 Update Worker job processor to set status apps/worker/src/queue/worker.ts-->
<!-- 6.5 Update API to enqueue with runId  -->
<!-- 6.6 Create stack detection apps/worker/src/services/stackDetector.ts-->
This isn’t “smart” yet, but it gives my UI real content today.
Step 5 creates the “truth” my whole product revolves around, and Step 6 is just the worker updating that truth.

If I skip Step 5 (DB schema + tables), then:

The API can enqueue jobs 

The worker can process jobs 

But i have no persistent record of:

what repo was analyzed

which run is in progress

results to show in the UI

history for the dashboard

status for polling (queued/running/done/failed)

So the app becomes “logs in the terminal” instead of a real product.

What each step contributes

Step 5 (DB foundation):

Defines Project + AnalysisRun

Gives every analysis a runId

Lets the frontend do: “submit → get runId → poll status”

Makes results survive restarts 

Step 6 (execution + updates):

Worker takes {runId, repoUrl}

Sets run status to RUNNING

Writes result JSON into the run

Marks run DONE or FAILED

So Step 6 depends on Step 5.
Step 5 is the database contract; Step 6 is the worker fulfilling it.

Think of it like this

Step 5 = create the “invoice table”

Step 6 = actually “process the invoice” and update it

Both are needed for the product to feel real.
<!-- Step 7  Real repo inspection (GitHub API) + better stack detection-->
✅ Worker reads real files from a GitHub repo (public repos)
✅ Detects stack from package.json, angular.json, etc.
✅ Stores a richer result JSON in the DB

For now we support public repos without auth.
<!-- 7.1 Worker: Add a GitHub repo URL parser apps/worker/src/integrations/github/parseRepoUrl.ts-->
<!-- 7.2 Worker: GitHub Contents API client apps/worker/src/integrations/github/githubContents.ts -->
Why this approach

Super fast

No cloning, no disk, no git required

Great for hackathon demos
<!-- 7.3 Worker: Improved stack detection using repo files apps/worker/src/services/stackDetectorFromRepo.ts-->
<!-- 7.4 Update Worker job to use GitHub detection Edit: apps/worker/src/queue/worker.ts -->
✅ Worker now reads real repo files and produces real signals.
<!-- Step 8 -- AI generation. Add LLM integration in Worker (Groq-compatible) -->
We’ll generate 3 deliverables from the detected stack and store them inside AnalysisRun.result:

Dockerfile

GitHub Actions workflow (CI/CD)

DigitalOcean App Platform spec (app.yaml)

✅ No Spaces yet. First we generate + store in DB so my UI can show results immediately.
<!-- 8.1 Add env vars (Worker) Update apps/worker/.env-->
<!-- 8.2 Worker env validation Edit apps/worker/src/config/env.ts-->
<!-- 8.3 Create a tiny Groq-compatible client apps/worker/src/integrations/llm/openaiClient.ts-->
<!-- 8.4 Prompt templates (deterministic, hackathon-safe) -->
<!-- 8.5 Artifact generator service apps/worker/src/services/artifactGenerator.ts-->
<!-- 8.6 Update Worker job: after stack detection, generate artifacts & save Edit apps/worker/src/queue/worker.ts-->
<!-- Step 9 -- Zip export + download endpoint -->
