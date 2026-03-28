import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Site } from '../types';

export const SiteList: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Partial<Site>>({});

  useEffect(() => {
    setSites(db.sites.getAll());
  }, []);

  const saveSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSite.name) return;
    
    const site: Site = {
      id: editingSite.id || Date.now().toString(),
      name: editingSite.name,
      clientName: editingSite.clientName || '',
      contactNumber: editingSite.contactNumber || '',
      location: editingSite.location || ''
    };
    
    if (editingSite.id) {
      // In a real app we'd need an update method, for now delete/add works for simple local storage
      db.sites.delete(editingSite.id);
      db.sites.add(site);
    } else {
      db.sites.add(site);
    }
    
    setSites(db.sites.getAll());
    setIsModalOpen(false);
    setEditingSite({});
  };

  const deleteSite = (id: string) => {
    if(confirm('Delete site? This will unassign guards.')) {
      db.sites.delete(id);
      setSites(db.sites.getAll());
    }
  };

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Site Management</h2>
        <button 
          onClick={() => { setEditingSite({}); setIsModalOpen(true); }}
          className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <span className="material-icons">add_business</span> Add Site
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-auto">
        {sites.map(site => (
          <div key={site.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
                <span className="material-icons">apartment</span>
              </div>
              <button onClick={() => deleteSite(site.id)} className="text-slate-400 hover:text-red-500">
                <span className="material-icons">delete</span>
              </button>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-1">{site.name}</h3>
            <p className="text-sm text-slate-500 mb-4">{site.location}</p>
            
            <div className="space-y-2 border-t border-slate-100 pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Client:</span>
                <span className="font-medium">{site.clientName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Contact:</span>
                <span className="font-medium">{site.contactNumber}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Add/Edit Site</h3>
            <form onSubmit={saveSite} className="space-y-4">
              <input 
                placeholder="Site Name" required 
                className="w-full border rounded p-2"
                value={editingSite.name || ''}
                onChange={e => setEditingSite({...editingSite, name: e.target.value})}
              />
              <input 
                placeholder="Client Name" 
                className="w-full border rounded p-2"
                value={editingSite.clientName || ''}
                onChange={e => setEditingSite({...editingSite, clientName: e.target.value})}
              />
              <input 
                placeholder="Location" 
                className="w-full border rounded p-2"
                value={editingSite.location || ''}
                onChange={e => setEditingSite({...editingSite, location: e.target.value})}
              />
              <input 
                placeholder="Contact Number" 
                className="w-full border rounded p-2"
                value={editingSite.contactNumber || ''}
                onChange={e => setEditingSite({...editingSite, contactNumber: e.target.value})}
              />
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600">Cancel</button>
                <button className="px-4 py-2 bg-primary text-white rounded">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};