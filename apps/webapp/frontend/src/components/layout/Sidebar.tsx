import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Database,
  Activity,
  Search,
  Bell,
  FileSearch,
  Bot,
  Box,
  Brain,
  HardDrive,
  Shield,
  FileText,
  Settings,
  ChevronDown,
  Eye
} from 'lucide-react';
import { useState } from 'react';

interface NavItem {
  name: string;
  path: string;
  icon: any;
  children?: NavItem[];
}

const navigation: NavItem[] = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Data Sources', path: '/data-sources', icon: Database },
  { name: 'Live Monitor', path: '/live-monitor', icon: Activity },
  { name: 'Detection & Investigation', path: '/detection', icon: Shield },
  { name: 'Views', path: '/views', icon: Eye },
  { name: 'Agents', path: '/agents', icon: Bot },
  { name: 'Data Models', path: '/data-models', icon: Box },
  { name: 'ML Models', path: '/ml-models', icon: Brain },
  { name: 'Storage', path: '/storage', icon: HardDrive },
  { name: 'Authorization', path: '/authorization', icon: Shield },
  { name: 'Audit Logs', path: '/audit-logs', icon: FileText },
  { name: 'Settings', path: '/settings', icon: Settings }
];

export function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`${collapsed ? 'w-20' : 'w-64'} bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 flex flex-col`}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center space-x-2">
              <Activity className="h-8 w-8 text-primary-600" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">DNA Pulse</span>
            </div>
          )}
          {collapsed && (
            <Activity className="h-8 w-8 text-primary-600 mx-auto" />
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  title={collapsed ? item.name : undefined}
                >
                  <item.icon className={`${collapsed ? '' : 'mr-3'} h-5 w-5 flex-shrink-0`} />
                  {!collapsed && <span>{item.name}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ChevronDown className={`h-5 w-5 transition-transform ${collapsed ? 'rotate-90' : '-rotate-90'}`} />
        </button>
      </div>
    </div>
  );
}
