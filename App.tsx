import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { GuardList } from './components/GuardList';
import { SiteList } from './components/SiteList';
import { AttendanceSheet } from './components/AttendanceSheet';
import { Expenses } from './components/Expenses';
import { SalaryReport } from './components/SalaryReport';
import { Invoice } from './components/Invoice';
import { ViewState } from './types';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('DASHBOARD');

  return (
    <Layout currentView={view} onNavigate={setView}>
      {view === 'DASHBOARD' && <Dashboard onNavigate={setView} />}
      {view === 'GUARDS' && <GuardList />}
      {view === 'SITES' && <SiteList />}
      {view === 'ATTENDANCE' && <AttendanceSheet />}
      {view === 'EXPENSES' && <Expenses />}
      {view === 'SALARY' && <SalaryReport />}
      {view === 'INVOICE' && <Invoice />}
    </Layout>
  );
};

export default App;