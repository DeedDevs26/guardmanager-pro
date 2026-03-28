import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Guard, Site, AttendanceRecord, ShiftStatus } from '../types';

export const AttendanceSheet: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [sites, setSites] = useState<Site[]>([]);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    setSites(db.sites.getAll());
  }, []);

  useEffect(() => {
    if (selectedSiteId) {
      // Load guards for this site
      const siteGuards = db.guards.getAll().filter(g => g.siteId === selectedSiteId && g.status === 'Active');
      setGuards(siteGuards);
      
      // Load existing records for date and site
      const existing = db.attendance.getByDateAndSite(selectedDate, selectedSiteId);
      setRecords(existing);
    } else {
      setGuards([]);
      setRecords([]);
    }
  }, [selectedDate, selectedSiteId]);

  const getRecord = (guardId: string): AttendanceRecord => {
    return records.find(r => r.guardId === guardId) || {
      id: '', guardId, siteId: selectedSiteId, date: selectedDate,
      morning: { status: 'Unmarked', foodTaken: false },
      evening: { status: 'Unmarked', foodTaken: false },
      night: { status: 'Unmarked', foodTaken: false },
      overtimeHrs: 0
    };
  };

  const updateRecord = (guardId: string, updates: Partial<AttendanceRecord>) => {
    const current = getRecord(guardId);
    const updated = { ...current, ...updates };
    
    // Save to local state
    const newRecords = records.filter(r => r.guardId !== guardId);
    newRecords.push(updated);
    setRecords(newRecords);

    // Save to DB immediately (Offline first UX)
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

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Shift Attendance</h2>
          <p className="text-slate-500 text-sm">Mark Morning, Evening, and Night shifts separately.</p>
        </div>
        
        <div className="flex gap-4 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
          <input 
            type="date" 
            className="border-none focus:ring-0 text-slate-700 font-bold bg-transparent"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
          />
          <div className="w-px bg-slate-200"></div>
          <select 
            className="border-none focus:ring-0 text-slate-700 font-bold bg-transparent w-48"
            value={selectedSiteId}
            onChange={e => setSelectedSiteId(e.target.value)}
          >
            <option value="">Select Site...</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {!selectedSiteId ? (
        <div className="flex-1 flex items-center justify-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
          <p className="text-slate-400">Please select a site to mark attendance</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase sticky left-0 bg-slate-50">Guard Name</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase text-center border-l border-slate-200">Morning</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase text-center border-l border-slate-200">Evening</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase text-center border-l border-slate-200">Night</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase text-center border-l border-slate-200">Overtime (Hrs)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {guards.map(guard => {
                  const record = getRecord(guard.id);
                  return (
                    <tr key={guard.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm font-bold text-slate-700 sticky left-0 bg-white hover:bg-slate-50">
                        {guard.name}
                        <div className="text-xs text-slate-400 font-normal">{guard.code}</div>
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
      )}
    </div>
  );
};