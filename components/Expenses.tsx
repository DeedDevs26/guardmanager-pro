import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { ExpenseRecord, Guard } from '../types';

export const Expenses: React.FC = () => {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [newExpense, setNewExpense] = useState<Partial<ExpenseRecord>>({
    date: new Date().toISOString().split('T')[0],
    type: 'Advance'
  });

  useEffect(() => {
    refresh();
  }, []);

  const refresh = () => {
    setExpenses(db.expenses.getAll());
    setGuards(db.guards.getAll());
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.guardId || !newExpense.amount) return;

    db.expenses.add({
      id: Date.now().toString(),
      guardId: newExpense.guardId,
      date: newExpense.date!,
      amount: Number(newExpense.amount),
      reason: newExpense.reason || '',
      type: newExpense.type as any
    });
    
    setNewExpense({
      date: new Date().toISOString().split('T')[0],
      type: 'Advance',
      guardId: '',
      amount: 0,
      reason: ''
    });
    refresh();
  };

  const handleDelete = (id: string) => {
    if(confirm('Delete this expense entry?')) {
      db.expenses.delete(id);
      refresh();
    }
  };

  return (
    <div className="p-8 h-full flex flex-col gap-6">
      <h2 className="text-2xl font-bold text-slate-800">Expenses & Advances</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 overflow-hidden">
        {/* Entry Form */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
          <h3 className="font-bold text-lg mb-4">New Entry</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Select Guard</label>
              <select 
                required 
                className="w-full border rounded p-2 bg-slate-50"
                value={newExpense.guardId || ''}
                onChange={e => setNewExpense({...newExpense, guardId: e.target.value})}
              >
                <option value="">Select...</option>
                {guards.filter(g => g.status === 'Active').map(g => (
                  <option key={g.id} value={g.id}>{g.name} ({g.code})</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Date</label>
              <input 
                type="date" 
                required 
                className="w-full border rounded p-2 bg-slate-50"
                value={newExpense.date}
                onChange={e => setNewExpense({...newExpense, date: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Type</label>
              <select 
                className="w-full border rounded p-2 bg-slate-50"
                value={newExpense.type}
                onChange={e => setNewExpense({...newExpense, type: e.target.value as any})}
              >
                <option value="Advance">Salary Advance</option>
                <option value="Fine">Fine / Deduction</option>
                <option value="Other">Other Expense</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Amount (₹)</label>
              <input 
                type="number" 
                required 
                min="0"
                className="w-full border rounded p-2 bg-slate-50 font-bold text-primary"
                value={newExpense.amount || ''}
                onChange={e => setNewExpense({...newExpense, amount: Number(e.target.value)})}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Reason/Notes</label>
              <textarea 
                className="w-full border rounded p-2 bg-slate-50 h-20"
                value={newExpense.reason || ''}
                onChange={e => setNewExpense({...newExpense, reason: e.target.value})}
              ></textarea>
            </div>

            <button className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition">
              Add Entry
            </button>
          </form>
        </div>

        {/* List */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <span className="font-bold text-slate-500 text-sm">Recent Transactions</span>
          </div>
          <div className="overflow-auto flex-1">
            <table className="w-full text-left">
              <thead className="bg-white sticky top-0">
                <tr className="border-b border-slate-100">
                  <th className="px-6 py-3 text-xs font-bold text-slate-500">Date</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500">Guard</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500">Type</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 text-right">Amount</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.slice().reverse().map(exp => (
                  <tr key={exp.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 text-sm text-slate-600">{exp.date}</td>
                    <td className="px-6 py-3 text-sm font-medium text-slate-800">
                      {guards.find(g => g.id === exp.guardId)?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2 py-1 rounded font-bold ${
                        exp.type === 'Advance' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {exp.type}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-right font-bold text-slate-700">₹{exp.amount}</td>
                    <td className="px-6 py-3 text-right">
                      <button onClick={() => handleDelete(exp.id)} className="text-slate-400 hover:text-red-500">
                        <span className="material-icons text-sm">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};