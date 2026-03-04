import type { AgentType } from '../../services/agentTypesService';

interface AgentTypeCardProps {
  agentType: AgentType;
  isSelected: boolean;
  onClick: () => void;
}

export function AgentTypeCard({ agentType, isSelected, onClick }: AgentTypeCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
        isSelected
          ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl">{agentType.icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {agentType.displayName}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
            {agentType.description}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              v{agentType.version}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {agentType.instanceCount} {agentType.instanceCount === 1 ? 'instance' : 'instances'}
            </span>
          </div>

          {/* Instance status summary */}
          <div className="flex items-center gap-3 mt-2 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-gray-600 dark:text-gray-400">
                {agentType.onlineCount} online
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-gray-400" />
              <span className="text-gray-600 dark:text-gray-400">
                {agentType.offlineCount} offline
              </span>
            </div>
            {agentType.errorCount > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-gray-600 dark:text-gray-400">
                  {agentType.errorCount} error
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
