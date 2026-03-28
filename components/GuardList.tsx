import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Guard, Site } from '../types';

export const GuardList: React.FC = () => {
  const [guards, setGuards] = useState<Guard[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuard, setEditingGuard] = useState<Partial<Guard>>({});

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    setGuards(db.guards.getAll());
    setSites(db.sites.getAll());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newGuard: Guard = {
      id: editingGuard.id || Date.now().toString(),
      name: editingGuard.name || '',
      code: editingGuard.code || `SG-${Math.floor(Math.random() * 1000)}`,
      phone: editingGuard.phone || '',
      aadhaar: editingGuard.aadhaar || '',
      siteId: editingGuard.siteId || '',
      salaryPerShift: Number(editingGuard.salaryPerShift) || 0,
      foodCostPerShift: Number(editingGuard.foodCostPerShift) || 0,
      uniformDeduction: Number(editingGuard.uniformDeduction) || 0,
      joiningDate: editingGuard.joiningDate || new Date().toISOString().split('T')[0],
      status: editingGuard.status || 'Active'
    };

    if (editingGuard.id) {
      db.guards.update(newGuard);
    } else {
      db.guards.add(newGuard);
    }
    setIsModalOpen(false);
    setEditingGuard({});
    refreshData();
  };

  const handleDelete = (id: string) => {
    if(confirm('Are you sure you want to delete this guard?')) {
      db.guards.delete(id);
      refreshData();
    }
  };

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Employee Management</h2>
        <button 
          onClick={() => { setEditingGuard({}); setIsModalOpen(true); }}
          className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
        >
          <span className="material-icons">add</span> Add Guard
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Code</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Name</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Site</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Phone</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Rate/Shift</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {guards.map(guard => (
                <tr key={guard.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-mono text-slate-500">{guard.code}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-700">{guard.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {sites.find(s => s.id === guard.siteId)?.name || 'Unassigned'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{guard.phone}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 text-right">₹{guard.salaryPerShift}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      guard.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {guard.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => { setEditingGuard(guard); setIsModalOpen(true); }} className="text-primary hover:text-blue-800 mr-3">
                      <span className="material-icons text-lg">edit</span>
                    </button>
                    <button onClick={() => handleDelete(guard.id)} className="text-red-500 hover:text-red-700">
                      <span className="material-icons text-lg">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
              {guards.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">No guards found. Add one to get started.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6">
            <h3 className="text-xl font-bold mb-4">{editingGuard.id ? 'Edit Guard' : 'Add New Guard'}</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              <div className="col-span-1">
                <label className="block text-xs font-bold text-slate-500 mb-1">Full Name</label>
                <input required className="w-full border rounded p-2" value={editingGuard.name || ''} onChange={e => setEditingGuard({...editingGuard, name: e.target.value})} />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-bold text-slate-500 mb-1">Phone Number</label>
                <input required className="w-full border rounded p-2" value={editingGuard.phone || ''} onChange={e => setEditingGuard({...editingGuard, phone: e.target.value})} />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-bold text-slate-500 mb-1">Aadhaar Number</label>
                <input className="w-full border rounded p-2" value={editingGuard.aadhaar || ''} onChange={e => setEditingGuard({...editingGuard, aadhaar: e.target.value})} />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-bold text-slate-500 mb-1">Assigned Site</label>
                <select className="w-full border rounded p-2" value={editingGuard.siteId || ''} onChange={e => setEditingGuard({...editingGuard, siteId: e.target.value})}>
                  <option value="">Select Site...</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-bold text-slate-500 mb-1">Salary Per Shift (₹)</label>
                <input type="number" required className="w-full border rounded p-2" value={editingGuard.salaryPerShift || ''} onChange={e => setEditingGuard({...editingGuard, salaryPerShift: Number(e.target.value)})} />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-bold text-slate-500 mb-1">Food Cost Deduction (₹)</label>
                <input type="number" className="w-full border rounded p-2" value={editingGuard.foodCostPerShift || ''} onChange={e => setEditingGuard({...editingGuard, foodCostPerShift: Number(e.target.value)})} />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-bold text-slate-500 mb-1">Uniform Deduction (Total)</label>
                <input type="number" className="w-full border rounded p-2" value={editingGuard.uniformDeduction || ''} onChange={e => setEditingGuard({...editingGuard, uniformDeduction: Number(e.target.value)})} />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-bold text-slate-500 mb-1">Status</label>
                <select className="w-full border rounded p-2" value={editingGuard.status || 'Active'} onChange={e => setEditingGuard({...editingGuard, status: e.target.value as any})}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="col-span-2 flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-white rounded hover:bg-blue-700">Save Guard</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};