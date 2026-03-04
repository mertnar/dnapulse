import { useState } from 'react';
import { Download, Copy, X } from 'lucide-react';
import type { AgentType } from '../../services/agentTypesService';

interface AgentDownloadModalProps {
  agentType: AgentType;
  isOpen: boolean;
  onClose: () => void;
}

interface PlatformCardProps {
  icon: string;
  name: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

const PlatformCard = ({ icon, name, selected, disabled, onClick }: PlatformCardProps) => (
  <button
    type="button"
    disabled={disabled}
    className={`flex flex-col items-center p-4 border-2 rounded-lg transition-all ${
      selected
        ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
        : 'border-gray-200 dark:border-gray-700'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    onClick={disabled ? undefined : onClick}
  >
    <span className="text-4xl mb-2">{icon}</span>
    <span className="font-medium text-gray-900 dark:text-white">{name}</span>
  </button>
);

export function AgentDownloadModal({ agentType, isOpen, onClose }: AgentDownloadModalProps) {
  // For now, only Linux amd64 is supported for this agent
  const [platform] = useState<'linux'>('linux');
  const [arch] = useState<'amd64'>('amd64');
  const [apiKey, setApiKey] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Backend base URL
  // Prefer explicit VITE_BACKEND_URL, otherwise derive from VITE_API_URL, otherwise default to localhost:3001
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  const BACKEND_BASE_URL =
    // If VITE_BACKEND_URL is provided, use it directly
    (import.meta.env as any).VITE_BACKEND_URL ||
    // If API_BASE_URL is absolute, strip trailing /api
    (API_BASE_URL.startsWith('http')
      ? API_BASE_URL.replace(/\/api\/?$/, '')
      : 'http://localhost:3001');

  // Download package as ZIP (binary + agent.yaml) using query param
  const downloadUrl = `${BACKEND_BASE_URL}/downloads/${agentType.name}-linux-amd64?format=zip&agentTypeId=${agentType.id}`;

  // Platform-specific installation commands
  const getInstallCommand = () => {
    // Currently only Linux amd64 is supported
    return `# 1) Download agent package (binary + config template)
curl -L -o ./${agentType.name}-linux-amd64.zip "${downloadUrl}"

# 2) Extract package
unzip ./${agentType.name}-linux-amd64.zip -d ./${agentType.name}-agent
cd ./${agentType.name}-agent

# 3) Edit configuration and set your API key
sed -i 's/YOUR_API_KEY_HERE/${apiKey || 'YOUR_API_KEY'}/' agent.yaml

# 4) Register the agent
chmod +x ./linux-resource-monitor-linux-amd64
./linux-resource-monitor-linux-amd64 -config ./agent.yaml -register

# 5) Start the agent
./linux-resource-monitor-linux-amd64 -config ./agent.yaml`;
  };

  const installCommand = getInstallCommand();

  const handleCopy = () => {
    navigator.clipboard.writeText(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    try {
      // Fetch the binary from backend
      const response = await fetch(downloadUrl, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const contentType = response.headers.get('Content-Type') || '';
      if (contentType.includes('text/html')) {
        throw new Error(
          'Received HTML instead of binary. Please make sure the backend downloads endpoint is reachable from your browser.',
        );
      }

      // Get the blob
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${agentType.name}-linux-amd64`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Download error:', error);
      alert(`Failed to download: ${error.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{agentType.icon}</span>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {agentType.displayName}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Download & Install</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Platform Selection (only Linux is currently supported) */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Select Platform
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <PlatformCard
                icon="🐧"
                name="Linux"
                selected
              />
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Currently only <span className="font-semibold">Linux (amd64)</span> builds are available for this agent.
            </p>
          </div>

          {/* Architecture Selection (only amd64 is currently supported) */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Select Architecture
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  'bg-primary-600 text-white'
                }`}
              >
                x86_64 (amd64)
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              ARM and other architectures will be available in future releases.
            </p>
          </div>

          {/* API Key Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="dna_..."
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Get your API key from the Settings page
            </p>
          </div>

          {/* Download Button */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleDownload}
              disabled={!apiKey}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="h-5 w-5" />
              Download Binary
            </button>
          </div>

          {/* Installation Instructions */}
          <div className="bg-gray-900 dark:bg-gray-950 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-white font-semibold">Quick Install Command</h4>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-2 px-3 py-1 text-sm text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded transition-colors"
              >
                {copied ? (
                  <>
                    <span className="text-green-400">✓</span>
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="text-green-400 text-sm overflow-x-auto whitespace-pre-wrap break-all font-mono">
              {installCommand}
            </pre>
          </div>

          {/* Additional Notes */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              📝 Additional Setup
            </h4>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>• After registration, the agent will automatically start collecting data</li>
              <li>• Monitor agent status in the Agents page</li>
              <li>• View collected metrics in Live Monitor</li>
              <li>• Configure the agent using the web UI or by editing the config file</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
