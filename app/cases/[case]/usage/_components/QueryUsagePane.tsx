import {
  pivotQueryTimingMetrics,
  QueryTimingMetricArray,
  QueryTimingMetricPivotEntry,
} from '@/lib/types';
import { Fragment } from 'react/jsx-runtime';

const stats = [
  {
    id: 'successful-queries',
    name: 'Successful Queries',
    value: (entry: QueryTimingMetricPivotEntry) => entry.successfulQueries,
  },
  {
    id: 'average-successful-query-time',
    name: 'Average Successful Query Time (sec)',
    value: (entry: QueryTimingMetricPivotEntry) =>
      entry.averageSuccessfulQueryTime / 1000,
  },
  {
    id: 'failed-queries',
    name: 'Failed Queries',
    value: (entry: QueryTimingMetricPivotEntry) => entry.failedQueries,
  },
  {
    id: 'average-failed-query-time',
    name: 'Average Failed Query Time (sec)',
    value: (entry: QueryTimingMetricPivotEntry) =>
      entry.averageFailedQueryTime / 1000,
  },
  {
    id: 'overall-average-query-time',
    name: 'Overall Average Query Time (sec)',
    value: (entry: QueryTimingMetricPivotEntry) =>
      entry.overallAverageQueryTime / 1000,
  },
];

export const nameConverter = (name: string) => {
  switch (name) {
    case 'fast-qa':
      return 'Quick Answers';
    case 'declaration':
      return 'Declarations';
    default:
      return 'Unknown';
  }
};

export function QueryUsagePane({
  queryMetrics,
}: {
  queryMetrics: QueryTimingMetricArray;
}) {
  const pivotQueryMetrics = pivotQueryTimingMetrics(queryMetrics);
  return (
    pivotQueryMetrics && (
      <div className="bg-white py-8 md:py-12 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl mb-6">
              Query Usage Metrics
            </h2>
          </div>
          <div className="mx-0 md:mx-8">
            {pivotQueryMetrics.map((metric) => (
              <Fragment key={metric.name}>
                <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                  {nameConverter(metric.name)}
                </h2>
                <dl className="grid grid-cols-1 gap-x-8 gap-y-16 text-center lg:grid-cols-5 border-t border-gray-200 pt-10 dark:border-gray-700 mb-10">
                  {stats.map((stat) => (
                    <div
                      key={stat.id}
                      className="mx-auto flex max-w-xs flex-col gap-y-4">
                      <dt className="text-base/7 text-gray-600 dark:text-gray-400">
                        {stat.name}
                      </dt>
                      <dd className="order-first text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl dark:text-white">
                        {stat.value(metric).toLocaleString()}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    )
  );
}
