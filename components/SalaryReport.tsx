import React, { useState } from 'react';
import { db } from '../services/db';
import { SalarySlip } from '../types';

export const SalaryReport: React.FC = () => {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [slips, setSlips] = useState<SalarySlip[]>([]);

  const calculateSalary = () => {
    const guards = db.guards.getAll();
    const allAttendance = db.attendance.getAll();
    const allExpenses = db.expenses.getAll();

    const report: SalarySlip[] = guards.map(guard => {
      // 1. Filter attendance for this guard & month
      const guardAttendance = allAttendance.filter(a => 
        a.guardId === guard.id && a.date.startsWith(month)
      );

      // 2. Count Shifts and Food
      let presentShifts = 0;
      let foodCount = 0;
      
      guardAttendance.forEach(record => {
        ['morning', 'evening', 'night'].forEach(key => {
          const shift = (record as any)[key];
          if (shift.status === 'Present') {
            presentShifts++;
            if (shift.foodTaken) foodCount++;
          }
        });
      });

      // 3. Calculate Expenses (Advances)
      const guardExpenses = allExpenses.filter(e => 
        e.guardId === guard.id && e.date.startsWith(month)
      );
      const totalAdvance = guardExpenses.reduce((sum, e) => sum + e.amount, 0);

      // 4. Financials
      const grossSalary = presentShifts * guard.salaryPerShift;
      const totalFoodCost = foodCount * guard.foodCostPerShift;
      const netSalary = grossSalary - totalAdvance - totalFoodCost - guard.uniformDeduction;

      return {
        guardId: guard.id,
        guardName: guard.name,
        month,
        totalShifts: presentShifts,
        grossSalary,
        totalAdvance,
        totalFoodCost,
        uniformDeduction: guard.uniformDeduction,
        netSalary
      };
    });

    setSlips(report);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6 no-print">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Salary Report</h2>
          <p className="text-slate-500 text-sm">Automatic calculation based on attendance and advances</p>
        </div>
        <div className="flex gap-4">
          <input 
            type="month" 
            className="border border-slate-300 rounded-lg px-3"
            value={month}
            onChange={e => setMonth(e.target.value)}
          />
          <button 
            onClick={calculateSalary}
            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Calculate Report
          </button>
          <button 
            onClick={handlePrint}
            className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 flex items-center gap-2"
          >
            <span className="material-icons text-sm">print</span> Print
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        {slips.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            Click "Calculate Report" to generate salary slips for selected month.
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Guard Name</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">Total Shifts</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Gross Salary</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right text-red-500">Advance</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right text-red-500">Food Ded.</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right text-red-500">Uniform</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-700 uppercase text-right bg-slate-100">Net Salary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {slips.map((slip) => (
                  <tr key={slip.guardId} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-bold text-slate-700">{slip.guardName}</td>
                    <td className="px-6 py-4 text-center">{slip.totalShifts}</td>
                    <td className="px-6 py-4 text-right">₹{slip.grossSalary.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-red-500">- ₹{slip.totalAdvance.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-red-500">- ₹{slip.totalFoodCost.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-red-500">- ₹{slip.uniformDeduction.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-bold text-primary bg-slate-50 border-l border-slate-100">
                      ₹{slip.netSalary.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200 font-bold">
                 <tr>
                   <td className="px-6 py-4">TOTALS</td>
                   <td className="px-6 py-4 text-center">{slips.reduce((a,b) => a + b.totalShifts, 0)}</td>
                   <td className="px-6 py-4 text-right">₹{slips.reduce((a,b) => a + b.grossSalary, 0).toLocaleString()}</td>
                   <td className="px-6 py-4 text-right">₹{slips.reduce((a,b) => a + b.totalAdvance, 0).toLocaleString()}</td>
                   <td className="px-6 py-4 text-right">₹{slips.reduce((a,b) => a + b.totalFoodCost, 0).toLocaleString()}</td>
                   <td className="px-6 py-4 text-right">₹{slips.reduce((a,b) => a + b.uniformDeduction, 0).toLocaleString()}</td>
                   <td className="px-6 py-4 text-right text-primary">₹{slips.reduce((a,b) => a + b.netSalary, 0).toLocaleString()}</td>
                 </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
      
      {/* Print Footer */}
      <div className="hidden print:block mt-8 text-center text-sm text-slate-500">
        <p>Generated by GuardManager Pro Desktop System | {new Date().toLocaleDateString()}</p>
      </div>
    </div>
  );
};