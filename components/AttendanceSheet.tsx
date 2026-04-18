import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Guard, Site, AttendanceRecord, ShiftStatus } from '../types';

export const AttendanceSheet: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [sites, setSites] = useState<Site[]>([]);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  useEffect(() => {
    setSites(db.sites.getAll());
    setGuards(db.guards.getAll().filter(g => g.status === 'Active'));
  }, []);

  useEffect(() => {
    const existing = db.attendance.getAll().filter(r => r.date === selectedDate);
    setRecords(existing);
  }, [selectedDate]);

  const getRecord = (guard: Guard): AttendanceRecord => {
    return records.find(r => r.guardId === guard.id) || {
      id: '', guardId: guard.id, siteIds: [guard.siteId], date: selectedDate,
      morning: { status: 'Unmarked', foodTaken: false },
      evening: { status: 'Unmarked', foodTaken: false },
      night: { status: 'Unmarked', foodTaken: false },
      overtimeHrs: 0
    };
  };

  const updateRecord = (guardId: string, updates: Partial<AttendanceRecord>) => {
    const guardData = guards.find(g => g.id === guardId);
    if (!guardData) return;

    const current = getRecord(guardData);
    const updated = { ...current, ...updates };
    
    setRecords(prev => {
        const otherRecords = prev.filter(r => r.guardId !== guardId);
        return [...otherRecords, updated];
    });

    db.attendance.saveRecord(updated);
  };

  const toggleStatus = (current: ShiftStatus): ShiftStatus => {
    if (current.status === 'Unmarked') return { ...current, status: 'Present' };
    if (current.status === 'Present') return { ...current, status: 'Absent' };
    return { ...current, status: 'Unmarked' };
  };

  const toggleFood = (current: ShiftStatus): ShiftStatus => {
    return { ...current, foodTaken: !current.foodTaken };
  };

  const toggleSite = (guardId: string, siteId: string, currentIds: string[]) => {
    const newIds = currentIds.includes(siteId)
      ? currentIds.filter(id => id !== siteId)
      : [...currentIds, siteId];
    updateRecord(guardId, { siteIds: newIds });
  };

  return (
    <div className="p-8 h-full flex flex-col" onClick={() => setOpenDropdownId(null)}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Shift Attendance</h2>
          <p className="text-slate-500 text-sm">Mark Morning, Evening, and Night shifts separately.</p>
        </div>
        
        <div className="flex gap-4 bg-white p-2 rounded-lg border border-slate-200 shadow-sm" onClick={e => e.stopPropagation()}>
          <input 
            type="date" 
            className="border-none focus:ring-0 text-slate-700 font-bold bg-transparent"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase sticky left-0 bg-slate-50">Guard Name</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase border-l border-slate-200 min-w-[200px]">Site(s)</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase text-center border-l border-slate-200">Morning</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase text-center border-l border-slate-200">Evening</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase text-center border-l border-slate-200">Night</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase text-center border-l border-slate-200">Overtime (Hrs)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {guards.map(guard => {
                  const record = getRecord(guard);
                  const isDropdownOpen = openDropdownId === guard.id;
                  
                  return (
                    <tr key={guard.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm font-bold text-slate-700 sticky left-0 bg-white hover:bg-slate-50">
                        {guard.name}
                        <div className="text-xs text-slate-400 font-normal">{guard.code}</div>
                      </td>

                      <td className="px-4 py-4 border-l border-slate-100 relative">
                        <div className="relative" onClick={e => e.stopPropagation()}>
                          <button 
                            onClick={() => setOpenDropdownId(isDropdownOpen ? null : guard.id)}
                            className="w-full text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded p-1.5 min-h-[36px] flex flex-wrap gap-1 items-center transition-colors"
                          >
                            {record.siteIds.length === 0 ? (
                                <span className="text-slate-400 text-xs italic">No site selected</span>
                            ) : (
                                record.siteIds.map(sid => {
                                    const siteName = sites.find(s => s.id === sid)?.name || sid;
                                    return (
                                        <span key={sid} className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded font-bold border border-primary/20">
                                            {siteName}
                                        </span>
                                    );
                                })
                            )}
                            <span className="material-icons text-slate-400 text-sm ml-auto">expand_more</span>
                          </button>

                          {isDropdownOpen && (
                            <div className="absolute z-20 top-full left-0 mt-1 w-full max-h-48 overflow-auto bg-white border border-slate-200 rounded shadow-lg p-2 flex flex-col gap-1 anim-fade-in">
                                {sites.length === 0 ? (
                                    <div className="text-[10px] text-slate-400 p-2 italic">No sites available</div>
                                ) : (
                                    sites.map(s => (
                                        <label key={s.id} className="flex items-center gap-2 hover:bg-slate-50 p-1.5 rounded cursor-pointer text-xs font-medium text-slate-600">
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-slate-300 text-primary focus:ring-primary w-3.5 h-3.5"
                                                checked={record.siteIds.includes(s.id)}
                                                onChange={() => toggleSite(guard.id, s.id, record.siteIds)}
                                            />
                                            {s.name}
                                        </label>
                                    ))
                                )}
                            </div>
                          )}
                        </div>
                      </td>
                      
                      {['morning', 'evening', 'night'].map((shift) => {
                         const sData = (record as any)[shift] as ShiftStatus;
                         return (
                          <td key={shift} className="px-4 py-4 text-center border-l border-slate-100">
                            <div className="flex flex-col items-center gap-2">
                              <button 
                                onClick={() => updateRecord(guard.id, { [shift]: toggleStatus(sData) })}
                                className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                                  sData.status === 'Present' ? 'bg-emerald-500 text-white' :
                                  sData.status === 'Absent' ? 'bg-rose-500 text-white' :
                                  'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                }`}
                              >
                                <span className="material-icons text-sm">
                                  {sData.status === 'Present' ? 'check' : sData.status === 'Absent' ? 'close' : 'remove'}
                                </span>
                              </button>
                              
                              {sData.status === 'Present' && (
                                <button 
                                  onClick={() => updateRecord(guard.id, { [shift]: toggleFood(sData) })}
                                  className={`text-[10px] px-2 py-0.5 rounded border ${
                                    sData.foodTaken 
                                      ? 'bg-orange-100 border-orange-200 text-orange-700' 
                                      : 'bg-white border-slate-200 text-slate-400'
                                  }`}
                                >
                                  {sData.foodTaken ? 'Food Taken' : 'No Food'}
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}

                      <td className="px-4 py-4 text-center border-l border-slate-100">
                        <input 
                          type="number" 
                          min="0" 
                          max="12"
                          className="w-16 text-center border border-slate-200 rounded p-1"
                          value={record.overtimeHrs}
                          onChange={e => updateRecord(guard.id, { overtimeHrs: Number(e.target.value) })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex justify-between">
            <span>Showing {guards.length} guards</span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-500 rounded"></span> Present</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-rose-500 rounded"></span> Absent</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-slate-200 rounded"></span> Unmarked</span>
            </div>
          </div>
      </div>
    </div>
  );
};