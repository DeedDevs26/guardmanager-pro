import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Guard, Site } from '../types';
import { FileUpload } from './FileUpload';
import { fileStorage } from '../services/fileStorage';

export const GuardList: React.FC = () => {
  const [guards, setGuards] = useState<Guard[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuard, setEditingGuard] = useState<Partial<Guard>>({});
  const [selectedFiles, setSelectedFiles] = useState<{
    idProofAadhaar: File | null;
    idProofPan: File | null;
    idProofPhoto: File | null;
    idProofOthers: File[];
  }>({
    idProofAadhaar: null,
    idProofPan: null,
    idProofPhoto: null,
    idProofOthers: []
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    setGuards(db.guards.getAll());
    setSites(db.sites.getAll());
  };

  const handleFileSelect = (key: string, file: File | null) => {
    setSelectedFiles(prev => ({ ...prev, [key]: file }));
  };

  const handleAddOtherFile = (file: File | null) => {
    if (file) {
      setSelectedFiles(prev => ({ ...prev, idProofOthers: [...prev.idProofOthers, file] }));
    }
  };

  const removeOtherFile = (index: number) => {
    setSelectedFiles(prev => ({ ...prev, idProofOthers: prev.idProofOthers.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation: Aadhaar is mandatory
    const hasAadhaar = selectedFiles.idProofAadhaar || editingGuard.idProofAadhaar === 'UPLOADED';
    if (!hasAadhaar) {
      alert("Aadhaar Card is mandatory! Please upload it before saving.");
      return;
    }

    setIsSaving(true);
    try {
      const guardId = editingGuard.id || Date.now().toString();
      const guardName = editingGuard.name || 'Unknown';

      // Save files to local system
      const filesToSave = {
        idProofAadhaar: selectedFiles.idProofAadhaar,
        idProofPan: selectedFiles.idProofPan,
        idProofPhoto: selectedFiles.idProofPhoto,
        idProofOthers: selectedFiles.idProofOthers.length > 0 ? selectedFiles.idProofOthers : null
      };

      if (Object.values(filesToSave).some(f => f !== null)) {
        await fileStorage.saveGuardFiles(guardName, guardId, filesToSave);
      }

      const newGuard: Guard = {
        id: guardId,
        name: guardName,
        code: editingGuard.code || `SG-${Math.floor(Math.random() * 1000)}`,
        phone: editingGuard.phone || '',
        aadhaar: editingGuard.aadhaar || '',
        siteId: editingGuard.siteId || '',
        salaryPerShift: Number(editingGuard.salaryPerShift) || 0,
        foodCostPerShift: Number(editingGuard.foodCostPerShift) || 0,
        uniformDeduction: Number(editingGuard.uniformDeduction) || 0,
        joiningDate: editingGuard.joiningDate || new Date().toISOString().split('T')[0],
        status: editingGuard.status || 'Active',
        idProofAadhaar: selectedFiles.idProofAadhaar ? 'UPLOADED' : editingGuard.idProofAadhaar,
        idProofPan: selectedFiles.idProofPan ? 'UPLOADED' : editingGuard.idProofPan,
        idProofPhoto: selectedFiles.idProofPhoto ? 'UPLOADED' : editingGuard.idProofPhoto,
        idProofOthers: (editingGuard.idProofOthers || 0) + selectedFiles.idProofOthers.length
      };

      if (editingGuard.id) {
        db.guards.update(newGuard);
      } else {
        db.guards.add(newGuard);
      }
      
      setIsModalOpen(false);
      setEditingGuard({});
      setSelectedFiles({ idProofAadhaar: null, idProofPan: null, idProofPhoto: null, idProofOthers: [] });
      refreshData();
    } catch (err: any) {
      alert(`Error saving files: ${err.message}. Please ensure you've selected a destination folder.`);
    } finally {
      setIsSaving(false);
    }
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
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Employee Management</h2>
          <p className="text-sm text-slate-500">Aadhaar Card is mandatory for all guards.</p>
        </div>
        <button 
          onClick={() => { 
            setEditingGuard({}); 
            setSelectedFiles({ idProofAadhaar: null, idProofPan: null, idProofPhoto: null, idProofOthers: [] });
            setIsModalOpen(true); 
          }}
          className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all font-bold"
        >
          <span className="material-icons">add</span> Add Guard
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Code</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Site</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Docs</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Rate/Shift</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {guards.map(guard => (
                <tr key={guard.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-mono text-slate-500">{guard.code}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-700">{guard.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {sites.find(s => s.id === guard.siteId)?.name || 'Unassigned'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1 items-center">
                      <span className={`material-icons text-sm ${guard.idProofAadhaar ? 'text-green-500' : 'text-red-300'}`} title="Aadhaar">badge</span>
                      <span className={`material-icons text-sm ${guard.idProofPan ? 'text-green-500' : 'text-slate-200'}`} title="PAN">credit_card</span>
                      <span className={`material-icons text-sm ${guard.idProofPhoto ? 'text-green-500' : 'text-slate-200'}`} title="Photo">account_box</span>
                      {guard.idProofOthers ? (
                        <div className="ml-1 bg-blue-100 text-blue-600 text-[10px] font-bold px-1 rounded flex items-center h-4" title="Other Documents">
                          +{guard.idProofOthers}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 text-right font-medium">₹{guard.salaryPerShift}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      guard.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {guard.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => { 
                      setEditingGuard(guard); 
                      setSelectedFiles({ idProofAadhaar: null, idProofPan: null, idProofPhoto: null, idProofOthers: [] });
                      setIsModalOpen(true); 
                    }} className="text-blue-400 hover:text-blue-600 mr-3 transition-colors">
                      <span className="material-icons text-lg">edit</span>
                    </button>
                    <button onClick={() => handleDelete(guard.id)} className="text-red-400 hover:text-red-600 transition-colors">
                      <span className="material-icons text-lg">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
              {guards.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <span className="material-icons text-4xl mb-2 block">person_off</span>
                    No guards found. Add one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800">{editingGuard.id ? 'Edit Employee Details' : 'Register New Employee'}</h3>
              <div className="flex items-center gap-3">
                <button 
                  type="submit" 
                  form="guard-form"
                  disabled={isSaving}
                  className={`px-6 py-2 text-white rounded-lg shadow-lg font-bold flex items-center gap-2 transition-all text-sm
                    ${!(selectedFiles.idProofAadhaar || editingGuard.idProofAadhaar === 'UPLOADED') 
                      ? 'bg-slate-300 cursor-not-allowed shadow-none' 
                      : 'bg-primary hover:bg-blue-700 shadow-blue-500/20'}`}
                >
                  {isSaving ? (
                    <>
                      <span className="material-icons animate-spin text-xs">sync</span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <span className="material-icons text-sm">save</span>
                      Save Employee
                    </>
                  )}
                </button>
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-200 transition-colors"
                >
                  <span className="material-icons">close</span>
                </button>
              </div>
            </div>
            
            <form id="guard-form" onSubmit={handleSubmit} className="overflow-auto p-6 flex-1">
              <div className="grid grid-cols-2 gap-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-primary uppercase tracking-widest border-l-4 border-primary pl-3">Personal Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-500 mb-1">Full Name</label>
                      <input required className="w-full border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={editingGuard.name || ''} onChange={e => setEditingGuard({...editingGuard, name: e.target.value})} />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-bold text-slate-500 mb-1">Phone Number</label>
                      <input required className="w-full border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={editingGuard.phone || ''} onChange={e => setEditingGuard({...editingGuard, phone: e.target.value})} />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-bold text-slate-500 mb-1">Aadhaar Number</label>
                      <input className="w-full border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={editingGuard.aadhaar || ''} onChange={e => setEditingGuard({...editingGuard, aadhaar: e.target.value})} />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-bold text-slate-500 mb-1">Assigned Site</label>
                      <select className="w-full border border-slate-200 rounded-lg p-2.5 outline-none" value={editingGuard.siteId || ''} onChange={e => setEditingGuard({...editingGuard, siteId: e.target.value})}>
                        <option value="">Select Site...</option>
                        {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-bold text-slate-500 mb-1">Status</label>
                      <select className="w-full border border-slate-200 rounded-lg p-2.5 outline-none" value={editingGuard.status || 'Active'} onChange={e => setEditingGuard({...editingGuard, status: e.target.value as any})}>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>

                  <h4 className="text-sm font-bold text-primary uppercase tracking-widest border-l-4 border-primary pl-3 pt-2">Salary Config</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Salary Per Shift (₹)</label>
                      <input type="number" required className="w-full border border-slate-200 rounded-lg p-2.5 outline-none" value={editingGuard.salaryPerShift || ''} onChange={e => setEditingGuard({...editingGuard, salaryPerShift: Number(e.target.value)})} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Food Cost /Shift (₹)</label>
                      <input type="number" className="w-full border border-slate-200 rounded-lg p-2.5 outline-none" value={editingGuard.foodCostPerShift || ''} onChange={e => setEditingGuard({...editingGuard, foodCostPerShift: Number(e.target.value)})} />
                    </div>
                  </div>
                </div>

                {/* ID Proofs */}
                <div className="space-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col">
                  <h4 className="text-sm font-bold text-primary uppercase tracking-widest border-l-4 border-primary pl-3">Document Uploads</h4>
                  <div className="space-y-4 overflow-y-auto pr-2 max-h-[500px]">
                    <FileUpload 
                      label="Aadhaar Card (Mandatory)"
                      onFileSelect={(f) => handleFileSelect('idProofAadhaar', f)}
                      initialFileName={editingGuard.idProofAadhaar === 'UPLOADED' ? 'Stored on System' : undefined}
                      required={!(selectedFiles.idProofAadhaar || editingGuard.idProofAadhaar === 'UPLOADED')}
                    />
                    <FileUpload 
                      label="PAN Card (PDF/JPG)"
                      onFileSelect={(f) => handleFileSelect('idProofPan', f)}
                      initialFileName={editingGuard.idProofPan === 'UPLOADED' ? 'Stored on System' : undefined}
                    />
                    <FileUpload 
                      label="Passport Photo (JPG)"
                      onFileSelect={(f) => handleFileSelect('idProofPhoto', f)}
                      acceptedFormats="image/*"
                      initialFileName={editingGuard.idProofPhoto === 'UPLOADED' ? 'Stored on System' : undefined}
                    />
                    
                    <div className="border-t border-slate-200 pt-4 mt-2">
                      <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Other Documents</label>
                      <div className="space-y-2 mb-3">
                        {selectedFiles.idProofOthers.map((file, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-white p-2 border border-slate-200 rounded-lg text-xs">
                            <span className="material-icons text-sm text-slate-400">description</span>
                            <span className="flex-1 truncate">{file.name}</span>
                            <button type="button" onClick={() => removeOtherFile(idx)} className="text-red-400 hover:text-red-600"><span className="material-icons text-sm">close</span></button>
                          </div>
                        ))}
                      </div>
                      <FileUpload 
                        label="Add More..."
                        onFileSelect={handleAddOtherFile}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};