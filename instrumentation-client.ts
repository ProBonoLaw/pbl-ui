import {
  ApplicationInsights,
  DistributedTracingModes,
} from '@microsoft/applicationinsights-web';

const connectionString = process.env.NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING;

if (connectionString) {
  // Keep it resilient: don't let monitoring break the app
  try {
    const appInsights = new ApplicationInsights({
      config: {
        connectionString,
        // Automatically track SPA route changes as page views
        enableAutoRouteTracking: true,
        distributedTracingMode: DistributedTracingModes.AI_AND_W3C,
        enableCorsCorrelation: true,
      },
    });

    appInsights.loadAppInsights();
    appInsights.trackPageView(); // initial page view
  } catch {
    // no-op
  }
}
