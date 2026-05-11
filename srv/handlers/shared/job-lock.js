"use strict";

const cds = require("@sap/cds");

/**
 * Distributed job locking using the database.
 *
 * Every container runs its own cron scheduler.
 * Only the instance that successfully acquires the
 * lock should execute the job.
 */

const DEFAULT_LOCK_TTL_MINUTES = 30;

async function acquireLock(jobName, instanceId, ttlMinutes = DEFAULT_LOCK_TTL_MINUTES) {
  const { JobLocks } = cds.entities("my.billing");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60000).toISOString();

  // Try to claim an expired or existing lock atomically
  const updateResult = await cds.run(
    UPDATE(JobLocks)
      .set({
        lockedAt: now.toISOString(),
        lockedBy: instanceId,
        expiresAt,
      })
      .where({
        jobName,
        expiresAt: { "<": now.toISOString() },
      }),
  );

  if (updateResult > 0) {
    return true;
  }

  // No existing/expired lock, try to insert a fresh one
  try {
    await cds.run(
      INSERT.into(JobLocks).entries({
        ID: cds.utils.uuid(),
        jobName,
        lockedAt: now.toISOString(),
        lockedBy: instanceId,
        expiresAt,
      }),
    );
    return true;
  } catch (err) {
    // Unique constraint violation, another instance got there first
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE" || err.code === 301 || err.statusCode === 301) {
      return false;
    }
    throw err;
  }
}

async function releaseLock(jobName) {
  const { JobLocks } = cds.entities("my.billing");
  await cds.run(DELETE.from(JobLocks).where({ jobName }));
}

module.exports = {
  acquireLock,
  releaseLock,
};
