import { Queue } from 'bullmq';
import { bullmqConnection } from '../config/redis.js';

// Backfill init: one-shot job per new workspace connection (metadata + item seeding)
export const backfillInitQueue = new Queue('backfill_init', { connection: bullmqConnection });

// High priority: work items updated in last 90 days — user sees charts within ~15 min
export const backfillHighQueue = new Queue('backfill_high', { connection: bullmqConnection });

// Low priority: work items older than 90 days — completes in background
export const backfillLowQueue = new Queue('backfill_low', { connection: bullmqConnection });

// Incremental sync: polls every 30 min for changed items
export const incrementalQueue = new Queue('incremental', { connection: bullmqConnection });

// Metrics compute + webhook processing (priority 1 = highest for webhooks)
export const metricsQueue = new Queue('metrics_compute', { connection: bullmqConnection });
