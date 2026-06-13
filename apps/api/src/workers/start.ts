// Worker process entrypoint — separate from the HTTP server
import '../workers/backfillWorker.js';
import '../workers/incrementalWorker.js';
import '../workers/metricsWorker.js';
import { scheduleAllIncrementalSyncs } from '../workers/incrementalWorker.js';

console.log('[worker] Starting BullMQ workers...');
await scheduleAllIncrementalSyncs();
console.log('[worker] Workers started');
