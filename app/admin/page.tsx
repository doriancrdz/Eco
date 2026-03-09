'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Search, Crown, Users, Gift } from 'lucide-react';

// EMAIL ADMIN - À REMPLACER PAR TON EMAIL
const ADMIN_EMAIL = 'cdorian654@yahoo.com';

interface User {
  id: string;
  clerkUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  plan: string;
  minutesIncluded: number;
  minutesUsed: number;
  bonusMinutes: number;
  currentPeriodEnd: string | null;
  createdAt: string;
}

export default function AdminPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newPlan, setNewPlan] = useState('student');
  const [updating, setUpdating] = useState(false);

  // Vérifier que c'est l'admin
  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      router.push('/sign-in');
      return;
    }

    if (user.primaryEmailAddress?.emailAddress !== ADMIN_EMAIL) {
      router.push('/');
    }
  }, [user, isLoaded, router]);

  // Charger les utilisateurs
  useEffect(() => {
    if (!isLoaded) return;
    if (user?.primaryEmailAddress?.emailAddress === ADMIN_EMAIL) {
      fetchUsers();
    }
  }, [user, isLoaded]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Erreur chargement users:', error);
    }
    setLoading(false);
  };

  const handleGrantPlan = async (userId: string) => {
    setUpdating(true);
    try {
      console.log('[Admin] Plan sélectionné:', newPlan);
      console.log('[Admin] Envoi grant-plan:', { userId, plan: newPlan });
      const response = await fetch('/api/admin/grant-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, plan: newPlan }),
      });

      const data = await response.json();
      if (data.success) {
        alert('Plan accordé avec succès !');
        fetchUsers();
        setSelectedUser(null);
      } else {
        alert('Erreur : ' + data.error);
      }
    } catch (error) {
      alert('Erreur réseau');
    }
    setUpdating(false);
  };

  const filteredUsers = users.filter((u) => {
    const term = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(term) ||
      u.firstName?.toLowerCase().includes(term) ||
      u.lastName?.toLowerCase().includes(term)
    );
  });

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Crown className="w-10 h-10 text-yellow-500" />
            Admin - Gestion des utilisateurs
          </h1>
          <p className="text-gray-600">
            Gérer les plans et accorder des accès gratuits
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-6 h-6 text-blue-600" />
              <p className="text-sm text-gray-600">Total utilisateurs</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">{users.length}</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <p className="text-sm text-gray-600 mb-2">Plan Free</p>
            <p className="text-3xl font-bold text-gray-900">
              {users.filter((u) => u.plan === 'free').length}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <p className="text-sm text-gray-600 mb-2">Plan Pro</p>
            <p className="text-3xl font-bold text-blue-600">
              {users.filter((u) => u.plan === 'pro').length}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <p className="text-sm text-gray-600 mb-2">Plan Business</p>
            <p className="text-3xl font-bold text-purple-600">
              {users.filter((u) => u.plan === 'business').length}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par email ou nom..."
              className="w-full pl-12 pr-4 py-3 bg-white rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  Utilisateur
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  Email
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  Plan
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  Minutes
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  Inscription
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">
                      {u.firstName || u.lastName
                        ? `${u.firstName || ''} ${u.lastName || ''}`
                        : 'Non renseigné'}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-gray-600">{u.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`
                      inline-block px-3 py-1 rounded-full text-sm font-medium
                      ${u.plan === 'free' ? 'bg-gray-100 text-gray-700' : ''}
                      ${u.plan === 'student' ? 'bg-green-100 text-green-700' : ''}
                      ${u.plan === 'pro' ? 'bg-blue-100 text-blue-700' : ''}
                      ${u.plan === 'business' ? 'bg-purple-100 text-purple-700' : ''}
                    `}
                    >
                      {u.plan === 'free' ? 'Free' : ''}
                      {u.plan === 'student' ? 'Student' : ''}
                      {u.plan === 'pro' ? 'Pro' : ''}
                      {u.plan === 'business' ? 'Business' : ''}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-gray-900">
                      {u.minutesIncluded - u.minutesUsed} / {u.minutesIncluded}
                    </p>
                    {u.bonusMinutes > 0 && (
                      <p className="text-xs text-green-600">+ {u.bonusMinutes} bonus</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-gray-600 text-sm">
                      {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => {
                        setSelectedUser(u);
                      setNewPlan('student');
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-shadow"
                    >
                      <Gift className="w-4 h-4" />
                      Modifier plan
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal modifier plan */}
        {selectedUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <h3 className="text-2xl font-bold mb-4">Modifier le plan</h3>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-1">Utilisateur</p>
                <p className="font-medium text-gray-900">{selectedUser.email}</p>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-1">Plan actuel</p>
                <p className="font-medium text-gray-900 capitalize">
                  {selectedUser.plan}
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nouveau plan
                </label>
                <select
                  value={newPlan}
                  onChange={(e) => setNewPlan(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="student">Student (800 min) - Gratuit</option>
                  <option value="pro">Pro (2000 min) - Gratuit</option>
                  <option value="business">Business (6000 min) - Gratuit</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedUser(null)}
                  className="flex-1 px-6 py-3 bg-gray-100 rounded-xl font-medium hover:bg-gray-200"
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleGrantPlan(selectedUser.clerkUserId)}
                  disabled={updating}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg disabled:opacity-50"
                >
                  {updating ? 'Traitement...' : 'Accorder gratuitement'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

