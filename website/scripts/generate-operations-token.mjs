import { randomBytes } from 'node:crypto';

console.log(`OPERATIONS_MONITOR_TOKEN=${randomBytes(32).toString('base64url')}`);
