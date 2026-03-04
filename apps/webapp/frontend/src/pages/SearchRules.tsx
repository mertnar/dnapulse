import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Table } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Search, Plus, Play, Edit } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { searchRulesService } from '../services/searchRulesService';
import type { Rule } from '../types';

export function SearchRules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchRules = async () => {
      try {
        setLoading(true);
        const data = await searchRulesService.getRules();
        setRules(data);
      } catch (error) {
        console.error('Failed to fetch rules:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRules();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  const columns = [
    { key: 'name', header: 'Name', render: (rule: any) => (
      <Link to={`/search/rules/${rule.id}`} className="font-medium text-primary-600 hover:text-primary-700">
        {rule.name}
      </Link>
    )},
    { key: 'severity', header: 'Severity', render: (rule: any) => (
      <Badge variant={
        rule.severity === 'critical' ? 'danger' :
        rule.severity === 'high' ? 'warning' : 'info'
      }>
        {rule.severity}
      </Badge>
    )},
    { key: 'output_type', header: 'Output', render: (rule: any) => (
      <Badge variant="neutral">{rule.output_type}</Badge>
    )},
    { key: 'enabled', header: 'Status', render: (rule: any) => (
      <Badge variant={rule.enabled ? 'success' : 'neutral'}>
        {rule.enabled ? 'Enabled' : 'Disabled'}
      </Badge>
    )},
    { key: 'match_count', header: 'Matches', render: (rule: any) => (
      <span>{rule.match_count.toLocaleString()}</span>
    )},
    { key: 'last_run', header: 'Last Run', render: (rule: any) => (
      <span>{rule.last_run ? formatDistanceToNow(new Date(rule.last_run), { addSuffix: true }) : 'Never'}</span>
    )}
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Search & Rules</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Query telemetry data and create automated rules
        </p>
      </div>

      <Card>
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <Input
                placeholder="Enter search query (e.g., severity:error AND rate > 0.05)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            <Button variant="secondary" onClick={() => setShowSaveModal(true)}>
              Save as Rule
            </Button>
          </div>

          <div className="flex items-center space-x-4 text-sm">
            <button className="text-primary-600 hover:text-primary-700">
              Query Builder
            </button>
            <span className="text-gray-300 dark:text-gray-700">|</span>
            <button className="text-primary-600 hover:text-primary-700">
              Advanced Syntax
            </button>
            <span className="text-gray-300 dark:text-gray-700">|</span>
            <button className="text-primary-600 hover:text-primary-700">
              Load Saved Search
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Active Rules</h2>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Create Rule
          </Button>
        </div>
        <Table data={rules} columns={columns} />
      </Card>

      <Modal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        title="Save as Rule"
      >
        <div className="space-y-4">
          <Input label="Rule Name" placeholder="Enter rule name" />
          <Input label="Description" placeholder="Describe what this rule detects" />
          <Input label="Schedule (Cron)" placeholder="*/5 * * * *" defaultValue="*/5 * * * *" />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Severity
            </label>
            <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white">
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
              <option>Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Output Type
            </label>
            <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white">
              <option>Alert</option>
              <option>Metric</option>
              <option>New Data Model</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <Button variant="secondary" onClick={() => setShowSaveModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowSaveModal(false)}>
              Save Rule
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
