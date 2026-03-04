import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Table } from '../components/ui/Table';
import { Plus, Users, Shield } from 'lucide-react';
import { authorizationService } from '../services/authorizationService';
import { CreateUserModal } from '../components/authorization/CreateUserModal';
import type { User, Role } from '../types';

export function Authorization() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [usersData, rolesData] = await Promise.all([
          authorizationService.getUsers(),
          authorizationService.getRoles()
        ]);
        setUsers(usersData);
        setRoles(rolesData);
      } catch (error) {
        console.error('Failed to fetch authorization data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleUserCreated = () => {
    const fetchUsers = async () => {
      try {
        const usersData = await authorizationService.getUsers();
        setUsers(usersData);
      } catch (error) {
        console.error('Failed to refresh users:', error);
      }
    };
    fetchUsers();
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  const userColumns = [
    { key: 'full_name', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role' }
  ];

  const roleColumns = [
    { key: 'name', header: 'Role Name' },
    { key: 'permissions', header: 'Permissions', render: (role: any) => (
      <span>{Object.keys(role.permissions).length} resource types</span>
    )}
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Authorization</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage users, roles, and permissions
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{users.length}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Total Users</p>
            </div>
            <Users className="h-8 w-8 text-primary-600" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{roles.length}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Roles Defined</p>
            </div>
            <Shield className="h-8 w-8 text-primary-600" />
          </div>
        </Card>
      </div>

      <Card>
        <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('users')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab('roles')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'roles'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Roles & Permissions
            </button>
          </nav>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {activeTab === 'users' ? 'Users' : 'Roles'}
          </h2>
          <Button size="sm" onClick={() => activeTab === 'users' ? setShowCreateUserModal(true) : null}>
            <Plus className="h-4 w-4 mr-2" />
            {activeTab === 'users' ? 'Create User' : 'Create Role'}
          </Button>
        </div>

        {activeTab === 'users' ? (
          <Table data={users} columns={userColumns} />
        ) : (
          <Table data={roles} columns={roleColumns} />
        )}
      </Card>

      <CreateUserModal
        isOpen={showCreateUserModal}
        onClose={() => setShowCreateUserModal(false)}
        onUserCreated={handleUserCreated}
      />
    </div>
  );
}
