import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Guard, Site, AttendanceRecord } from '../types';

export const Dashboard: React.FC<{ onNavigate: (view: any) => void }> = ({ onNavigate }) => {
  const [stats, setStats] = useState({
    activeGuards: 0,
    totalSites: 0,
    presentToday: 0,
    monthlyExpense: 0
  });

  useEffect(() => {
    const guards = db.guards.getAll();
    const sites = db.sites.getAll();
    const attendance = db.attendance.getAll();
    const expenses = db.expenses.getAll();

    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = attendance.filter(a => a.date === today);

    // Count shifts present today
    let shiftsToday = 0;
    todayAttendance.forEach(a => {
      if (a.morning.status === 'Present') shiftsToday++;
      if (a.evening.status === 'Present') shiftsToday++;
      if (a.night.status === 'Present') shiftsToday++;
    });

    // Calculate approximate monthly expense (current month)
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlyExp = expenses
      .filter(e => e.date.startsWith(currentMonth))
      .reduce((sum, e) => sum + e.amount, 0);

    setStats({
      activeGuards: guards.filter(g => g.status === 'Active').length,
      totalSites: sites.length,
      presentToday: shiftsToday,
      monthlyExpense: monthlyExp
    });
  }, []);

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">System Dashboard</h2>
          <p className="text-slate-500 text-sm mt-1">Overview of security operations</p>
        </div>
        <div className="flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
          <span className="material-icons text-sm">wifi_off</span>
          Local Database Active
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon="security" 
          title="Active Guards" 
          value={stats.activeGuards} 
          sub="Total registered"
          color="bg-primary"
          onClick={() => onNavigate('GUARDS')}
        />
        <StatCard 
          icon="business" 
          title="Total Sites" 
          value={stats.totalSites} 
          sub="Operational locations"
          color="bg-purple-600"
          onClick={() => onNavigate('SITES')}
        />
        <StatCard 
          icon="assignment_ind" 
          title="Shifts Today" 
          value={stats.presentToday} 
          sub="Total present punches"
          color="bg-emerald-600"
          onClick={() => onNavigate('ATTENDANCE')}
        />
        <StatCard 
          icon="payments" 
          title="Expenses" 
          value={`₹${stats.monthlyExpense.toLocaleString()}`} 
          sub="Current month advances"
          color="bg-orange-500"
          onClick={() => onNavigate('EXPENSES')}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-bold mb-4 text-slate-700">Quick Actions</h3>
        <div className="flex gap-4">
          <button 
            onClick={() => onNavigate('ATTENDANCE')}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-blue-700 transition"
          >
            <span className="material-icons">calendar_today</span>
            Mark Attendance
          </button>
          <button 
            onClick={() => onNavigate('GUARDS')}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
          >
            <span className="material-icons">person_add</span>
            Add New Guard
          </button>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, title, value, sub, color, onClick }: any) => (
  <div onClick={onClick} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer group">
    <div className="flex items-center justify-between mb-4">
      <div className={`${color} p-3 rounded-lg text-white group-hover:scale-110 transition-transform`}>
        <span className="material-icons">{icon}</span>
      </div>
      <span className="text-slate-400 material-icons">chevron_right</span>
    </div>
    <h3 className="text-3xl font-bold text-slate-800">{value}</h3>
    <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mt-1">{title}</p>
    <p className="text-xs text-slate-400 mt-2">{sub}</p>
  </div>
);