import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { settingsService } from '../services/settingsService';
import { APIKeys } from './APIKeys';
import type { Organization } from '../types';

export function Settings() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'general' | 'api' | 'notifications'>('general');

  useEffect(() => {
    const fetchOrganization = async () => {
      try {
        setLoading(true);
        const data = await settingsService.getOrganization();
        setOrganization(data);
      } catch (error) {
        console.error('Failed to fetch organization:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganization();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Configure your organization and application settings
        </p>
      </div>

      <Card>
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="flex space-x-8">
            {[
              { id: 'general' as const, label: 'General' },
              { id: 'api' as const, label: 'API Keys' },
              { id: 'notifications' as const, label: 'Notifications' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === 'general' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Organization Profile
              </h3>
              <div className="space-y-4 max-w-2xl">
                <Input label="Organization Name" defaultValue={organization?.name} />
                <Input label="Contact Email" defaultValue="admin@acme.com" type="email" />
                <Input label="Website" defaultValue="https://acme.com" type="url" />
                <Button>Save Changes</Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'api' && (
          <div className="space-y-6">
            <APIKeys />
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Notification Preferences
            </h3>
            <div className="space-y-4">
              {[
                { label: 'Email Notifications', description: 'Receive email alerts for critical events' },
                { label: 'Slack Integration', description: 'Send notifications to Slack channel' },
                { label: 'Webhook Notifications', description: 'POST notifications to webhook endpoint' }
              ].map(pref => (
                <div key={pref.label} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{pref.label}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{pref.description}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
