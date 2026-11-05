import { useAzureMonitor as initializeAzureMonitor } from '@azure/monitor-opentelemetry';
import { logger } from '@/lib/logger';

// Uses APPLICATIONINSIGHTS_CONNECTION_STRING by default
const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
const telemetryDisabled = process.env.APPLICATIONINSIGHTS_DISABLED === 'true';

if (!telemetryDisabled) {
  if (!connectionString) {
    logger.warn(
      '[Azure Monitor] APPLICATIONINSIGHTS_CONNECTION_STRING is not set. ' +
        'Azure Monitor telemetry will not be initialized.',
    );
  } else {
    try {
      initializeAzureMonitor();
    } catch (err) {
      logger.error('[Azure Monitor] Failed to initialize Azure Monitor:', err);
    }
  }
}
