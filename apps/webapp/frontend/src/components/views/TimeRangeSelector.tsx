import { useState } from 'react';
import { Calendar, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';

interface TimeRangeSelectorProps {
  value: string;
  customRange: { from: Date; to: Date } | null;
  onChange: (range: string, custom?: { from: Date; to: Date }) => void;
}

const PRESET_RANGES = [
  { value: '15m', label: '15 min' },
  { value: '1h',  label: '1 hour' },
  { value: '6h',  label: '6 hours' },
  { value: '24h', label: '24 hours' },
  { value: '7d',  label: '7 days' },
  { value: '30d', label: '30 days' },
];

export function TimeRangeSelector({ value, customRange, onChange }: TimeRangeSelectorProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [fromDate, setFromDate] = useState(
    customRange?.from ? formatDateTimeLocal(customRange.from) : ''
  );
  const [toDate, setToDate] = useState(
    customRange?.to ? formatDateTimeLocal(customRange.to) : ''
  );

  const handlePresetChange = (preset: string) => {
    setShowCustom(false);
    onChange(preset);
  };

  const handleCustomApply = () => {
    if (fromDate && toDate) {
      const from = new Date(fromDate);
      const to = new Date(toDate);
      if (from > to) {
        alert('Start time cannot be after end time');
        return;
      }
      onChange('custom', { from, to });
      setShowCustom(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        {PRESET_RANGES.map(range => (
          <button
            key={range.value}
            onClick={() => handlePresetChange(range.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              value === range.value && !showCustom
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {range.label}
          </button>
        ))}

        <button
          onClick={() => setShowCustom(!showCustom)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1 ${
            value === 'custom' || showCustom
              ? 'bg-primary-600 text-white shadow-sm'
              : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          <Calendar className="h-3 w-3" />
          Custom
        </button>

        {customRange && value === 'custom' && !showCustom && (
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
            {formatDateTime(customRange.from)}
            <ChevronRight className="inline h-3 w-3 mx-1" />
            {formatDateTime(customRange.to)}
          </span>
        )}
      </div>

      {showCustom && (
        <div className="flex items-end gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Start
            </label>
            <input
              type="datetime-local"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              End
            </label>
            <input
              type="datetime-local"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>
          <Button variant="primary" size="sm" onClick={handleCustomApply} className="flex items-center gap-1.5">
            Apply
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowCustom(false)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

function formatDateTimeLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
