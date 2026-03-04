import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { HistogramBucket } from '../../services/liveMonitorService';

interface EventHistogramProps {
  data: HistogramBucket[];
  onTimeRangeSelect?: (start: Date, end: Date) => void;
}

export function EventHistogram({ data }: EventHistogramProps) {
  const chartData = data.map(bucket => {
    let ts: Date;
    try {
      ts = new Date(bucket.timestamp);
      if (isNaN(ts.getTime())) {
        ts = new Date(); // Fallback to current time if invalid
      }
    } catch {
      ts = new Date(); // Fallback to current time if error
    }

    return {
      time: ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      timestamp: bucket.timestamp,
      Critical: bucket.critical,
      High: bucket.high,
      Medium: bucket.medium,
      Low: bucket.low,
      Info: bucket.info,
      total: bucket.total
    };
  });

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
          <p className="text-xs font-medium text-gray-900 dark:text-white mb-2">{data.time}</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-gray-600 dark:text-gray-400">Total:</span>
              <span className="text-xs font-medium text-gray-900 dark:text-white">{data.total}</span>
            </div>
            {data.Critical > 0 && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-red-600">Critical:</span>
                <span className="text-xs font-medium text-red-600">{data.Critical}</span>
              </div>
            )}
            {data.High > 0 && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-orange-600">High:</span>
                <span className="text-xs font-medium text-orange-600">{data.High}</span>
              </div>
            )}
            {data.Medium > 0 && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-yellow-600">Medium:</span>
                <span className="text-xs font-medium text-yellow-600">{data.Medium}</span>
              </div>
            )}
            {data.Low > 0 && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-blue-600">Low:</span>
                <span className="text-xs font-medium text-blue-600">{data.Low}</span>
              </div>
            )}
            {data.Info > 0 && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-gray-600 dark:text-gray-400">Info:</span>
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{data.Info}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  if (!data || data.length === 0 || chartData.length === 0) {
    return (
      <div className="w-full h-32 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">No data available</p>
      </div>
    );
  }

  return (
    <div className="w-full h-32 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4" style={{ minHeight: '128px', minWidth: '100%' }}>
      <ResponsiveContainer width="100%" height="100%" minHeight={128} minWidth={0}>
        <BarChart data={chartData}>
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            stroke="#E5E7EB"
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            stroke="#E5E7EB"
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="Critical" stackId="a" fill="#DC2626" />
          <Bar dataKey="High" stackId="a" fill="#EA580C" />
          <Bar dataKey="Medium" stackId="a" fill="#CA8A04" />
          <Bar dataKey="Low" stackId="a" fill="#2563EB" />
          <Bar dataKey="Info" stackId="a" fill="#9CA3AF" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
