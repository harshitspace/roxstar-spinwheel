# Edge Cases Documentation

## Overview
This document lists every edge case identified and handled in the SpinWheel system,
along with the approach taken and the specific code location.

---

## EC-01: Concurrent Join — Same User Double Submit
**Problem:** A user spam-clicks the Join button, sending two simultaneous POST
requests before the first completes. Both pass the "already joined" check and
the user ends up charged twice.

**Approach:** Redis distributed lock using `SET NX EX` on key
`lock:join:{userId}:{wheelId}`. The first request acquires the lock and
processes. The second request fails to acquire the lock and receives a 429
immediately — no DB query needed.

**Code:** `src/utils/redisLock.js` → `withLock()`  
**Applied in:** `src/modules/spinwheel/spinwheel.service.js` → `joinWheel()`

---

## EC-02: Concurrent Join — Last Available Slot Race
**Problem:** Two different users join simultaneously when only one slot remains.
Both pass the `participants.length < maxParticipants` check before either
has written to the DB. The wheel ends up with one extra participant.

**Approach:** Second Redis lock on `lock:wheel_slot:{wheelId}` serialises all
join operations on a given wheel. Combined with the MongoDB transaction's
re-check inside the session, only one join commits.

**Code:** `src/utils/redisLock.js`  
**Applied in:** `src/modules/spinwheel/spinwheel.service.js` → `joinWheel()`

---

## EC-03: Insufficient Participants — Auto Abort + Refund
**Problem:** A wheel is created but fewer than 3 users join within 3 minutes.
The game cannot proceed. Participants who joined must be refunded.

**Approach:** Bull auto-start job fires at T+3min. The processor counts active
participants. If count < 3, `coinService.refundAll()` credits every participant
atomically within a single MongoDB transaction, wheel status is set to ABORTED,
and a `wheel:aborted` socket event is emitted.

**Code:** `src/queues/processors/autostart.processor.js`  
**Coin reversal:** `src/modules/coin/coin.service.js` → `refundAll()`

---

## EC-04: Server Crash Mid-Spin Recovery
**Problem:** The server process dies while a wheel is SPINNING. Scheduled
eliminations are lost. The game is stuck.

**Approach:** Bull persists all jobs in Redis. Jobs survive process restarts
because Redis data is stored in a named Docker volume (`redis_data`). On
server restart, Bull automatically re-queues delayed/waiting jobs. The
elimination processor reads the persisted `eliminationSequence` from MongoDB
so the order is not re-randomised.

**Verification steps:**
1. Start a wheel with 5 participants
2. Wait for round 1 elimination to fire
3. Run `docker compose restart app`
4. Observe: round 2 fires within 7 seconds of restart

**Code:** `src/queues/processors/elimination.processor.js`  
**Persistence:** `docker-compose.yml` → `redis_data` named volume

---

## EC-05: Invalid State Transitions
**Problem:** A race condition or bug causes a status update like
`COMPLETED → SPINNING` or `ABORTED → COMPLETED`, corrupting game state.

**Approach:** A state machine utility validates every transition before it is
applied. `COMPLETED` and `ABORTED` are terminal states — no transition out
is allowed. Any invalid transition throws a 400 ApiError before touching the DB.

**Valid transitions:**
- `WAITING → SPINNING` (game starts)
- `WAITING → ABORTED` (insufficient participants)
- `SPINNING → COMPLETED` (winner determined)
- `SPINNING → ABORTED` (manual abort — future feature)

**Code:** `src/utils/stateMachine.js` → `assertValidTransition()`

---

## EC-06: Admin Starts Wheel Before 3-Minute Timer
**Problem:** Admin manually starts the wheel at T+1min. The auto-start Bull job
still fires at T+3min, sees the wheel is `SPINNING`, and tries to process it
again — double-processing.

**Approach:** When admin manually starts, the `autoStartJobId` stored on the
wheel document is used to call `job.remove()` on the Bull queue. The
auto-start processor also has a guard: if `wheel.status !== 'WAITING'` on
entry, it exits immediately without side effects.

**Code:** `src/modules/spinwheel/spinwheel.service.js` → `startWheel()`  
**Guard:** `src/queues/processors/autostart.processor.js` lines 20-27

---

## EC-07: Atomic Coin Operations — No Partial Credits
**Problem:** A payout credits the winner but then the server crashes before
crediting the admin. Winner gets paid, admin does not. Database is inconsistent.

**Approach:** All coin operations (`distributeEntryFee`, `payoutWinner`,
`refundAll`) run inside a single MongoDB session with `startTransaction()`.
If any step fails, `abortTransaction()` rolls back all changes atomically.
The DB is never left in a partial state.

**Code:** `src/modules/coin/coin.service.js`  
All write operations pass the `session` parameter through every DB call.

---

## EC-08: Insufficient Coins at Join Time
**Problem:** User's coin balance changes between clicking Join and the
server processing the request (e.g. another concurrent join drained their
balance).

**Approach:** `debitCoins()` uses `findOneAndUpdate` with `$gte: amount`
in the filter — the balance check and the debit are a single atomic MongoDB
operation. If balance is insufficient at write time, the update finds no
document and throws a 400 error. The entire join transaction is then aborted.

**Code:** `src/modules/coin/coin.repository.js` → `debitCoins()`

---

## EC-09: Duplicate Active Wheel
**Problem:** Two admin requests to create a wheel arrive simultaneously.
Both check for an active wheel, both find none, and both create one —
violating the one-active-wheel constraint.

**Approach:** A partial unique index on `SpinWheel.status` for values
`['WAITING', 'ACTIVE', 'SPINNING']` enforces uniqueness at the database
level. Even if two create requests race past the application-level check,
the second MongoDB insert will throw a duplicate key error (E11000), which
the service catches and converts to a 409 ApiError.

**Code:** `src/models/SpinWheel.model.js` → partial unique index definition

---

## EC-10: JWT Token for Deleted User
**Problem:** A user is deleted by an admin but their JWT (valid for 7 days)
is still used to make requests.

**Approach:** The `protect` middleware verifies the JWT signature and then
does a live DB lookup for the user. If the user no longer exists in the DB,
a 401 is returned even though the token is cryptographically valid.

**Code:** `src/modules/auth/auth.middleware.js` → `protect()`