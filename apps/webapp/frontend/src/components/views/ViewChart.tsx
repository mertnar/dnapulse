import { useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { ChartConfig } from '../../services/detectionService';

interface ViewChartProps {
  data: any[];
  config: ChartConfig;
}

const DEFAULT_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
];

const DARK_TOOLTIP_STYLE = {
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
  borderRadius: '8px',
  fontSize: '12px',
  color: '#e5e7eb',
  padding: '8px 12px',
};

export function ViewChart({ data, config }: ViewChartProps) {
  const chartData = useMemo(() => {
    if (!config.xAxis) return [];

    const grouped = new Map<string, any>();

    data.forEach(item => {
      const xValue = getNestedValue(item, config.xAxis!);
      const key = String(xValue ?? 'N/A');

      if (!grouped.has(key)) grouped.set(key, { name: key });
      const entry = grouped.get(key)!;

      if (config.yAxis) {
        const yAxes = Array.isArray(config.yAxis) ? config.yAxis : [config.yAxis];

        yAxes.forEach(yAxis => {
          const yValue = getNestedValue(item, yAxis);

          switch (config.aggregation) {
            case 'count':
              entry[yAxis] = (entry[yAxis] || 0) + 1;
              break;
            case 'sum':
              entry[yAxis] = (entry[yAxis] || 0) + (Number(yValue) || 0);
              break;
            case 'avg':
              if (!entry[`_${yAxis}_sum`]) { entry[`_${yAxis}_sum`] = 0; entry[`_${yAxis}_n`] = 0; }
              entry[`_${yAxis}_sum`] += Number(yValue) || 0;
              entry[`_${yAxis}_n`] += 1;
              entry[yAxis] = entry[`_${yAxis}_sum`] / entry[`_${yAxis}_n`];
              break;
            case 'min':
              entry[yAxis] = Math.min(entry[yAxis] ?? Infinity, Number(yValue) || 0);
              break;
            case 'max':
              entry[yAxis] = Math.max(entry[yAxis] ?? -Infinity, Number(yValue) || 0);
              break;
            default:
              entry[yAxis] = Number(yValue) || 0;
          }
        });
      }
    });

    return Array.from(grouped.values());
  }, [data, config]);

  const colors = config.colors || DEFAULT_COLORS;
  const yAxes = config.yAxis
    ? (Array.isArray(config.yAxis) ? config.yAxis : [config.yAxis])
    : [];

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-72 text-gray-400 dark:text-gray-500">
        <p className="font-medium">No chart data available</p>
        <p className="text-sm mt-1">Configure X and Y axis fields in view settings</p>
      </div>
    );
  }

  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');

  const sharedProps = {
    grid: config.showGrid !== false && (
      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
    ),
    xAxis: <XAxis dataKey="name" tick={{ fontSize: 11, fill: isDark ? '#9ca3af' : '#6b7280' }} />,
    yAxis: <YAxis tick={{ fontSize: 11, fill: isDark ? '#9ca3af' : '#6b7280' }} />,
    tooltip: <Tooltip contentStyle={isDark ? DARK_TOOLTIP_STYLE : { borderRadius: '8px', fontSize: '12px' }} />,
    legend: config.showLegend !== false && <Legend wrapperStyle={{ fontSize: '12px' }} />,
  };

  const renderChart = () => {
    switch (config.type) {
      case 'line':
        return (
          <LineChart data={chartData}>
            {sharedProps.grid}
            {sharedProps.xAxis}
            {sharedProps.yAxis}
            {sharedProps.tooltip}
            {sharedProps.legend}
            {yAxes.map((y, i) => (
              <Line key={y} type="monotone" dataKey={y} stroke={colors[i % colors.length]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            ))}
          </LineChart>
        );

      case 'bar':
        return (
          <BarChart data={chartData}>
            {sharedProps.grid}
            {sharedProps.xAxis}
            {sharedProps.yAxis}
            {sharedProps.tooltip}
            {sharedProps.legend}
            {yAxes.map((y, i) => (
              <Bar key={y} dataKey={y} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} stackId={config.stacked ? 's' : undefined} />
            ))}
          </BarChart>
        );

      case 'area':
        return (
          <AreaChart data={chartData}>
            {sharedProps.grid}
            {sharedProps.xAxis}
            {sharedProps.yAxis}
            {sharedProps.tooltip}
            {sharedProps.legend}
            {yAxes.map((y, i) => (
              <Area key={y} type="monotone" dataKey={y} fill={colors[i % colors.length]} stroke={colors[i % colors.length]} fillOpacity={0.15} stackId={config.stacked ? 's' : undefined} />
            ))}
          </AreaChart>
        );

      case 'pie': {
        const pieData = chartData.map(item => ({
          name: item.name,
          value: yAxes.length > 0 ? item[yAxes[0]] : 1,
        }));
        return (
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="70%" innerRadius="40%" label={{ fontSize: 11 }} paddingAngle={2}>
              {pieData.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            {sharedProps.tooltip}
            {sharedProps.legend}
          </PieChart>
        );
      }

      case 'scatter':
        return (
          <ScatterChart>
            {sharedProps.grid}
            {sharedProps.xAxis}
            {sharedProps.yAxis}
            {sharedProps.tooltip}
            {sharedProps.legend}
            {yAxes.map((y, i) => (
              <Scatter key={y} name={y} data={chartData} fill={colors[i % colors.length]} />
            ))}
          </ScatterChart>
        );

      default:
        return (
          <div className="text-center py-12 text-gray-500">
            Unsupported chart type: {config.type}
          </div>
        );
    }
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      {renderChart()}
    </ResponsiveContainer>
  );
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}
