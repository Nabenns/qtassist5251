/**
 * Lightweight in-memory tracker for cron job runs. Every time a cron fires,
 * it should call `recordCronRun(name, status, details)` so the dashboard
 * can show "last run X minutes ago" and surface failures.
 *
 * Persistence is intentionally skipped — this is for live monitoring, not
 * historical analysis. A bot restart resets the table, which is fine.
 */

const runs = new Map(); // jobName -> { last, status, durationMs, error, count }

function recordCronStart(name) {
  const existing = runs.get(name) || { count: 0 };
  return {
    name,
    startedAt: Date.now(),
    finalize(status, details = {}) {
      const finishedAt = Date.now();
      runs.set(name, {
        name,
        last: new Date(finishedAt).toISOString(),
        status,
        durationMs: finishedAt - this.startedAt,
        error: details.error || null,
        count: (existing.count || 0) + 1,
        meta: details.meta || null
      });
    }
  };
}

function recordCronRun(name, status, details = {}) {
  const existing = runs.get(name) || { count: 0 };
  runs.set(name, {
    name,
    last: new Date().toISOString(),
    status,
    durationMs: details.durationMs ?? null,
    error: details.error || null,
    count: (existing.count || 0) + 1,
    meta: details.meta || null
  });
}

function getCronStatus() {
  return Array.from(runs.values()).sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = {
  recordCronStart,
  recordCronRun,
  getCronStatus
};
