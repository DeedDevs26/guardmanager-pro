import React, { useState } from 'react';
import { ViewState } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onNavigate }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  const NavItem = ({ view, icon, label }: { view: ViewState; icon: string; label: string }) => (
    <button
      onClick={() => onNavigate(view)}
      title={isCollapsed ? label : ''}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 mb-1 ${currentView === view
          ? 'bg-white/10 text-white border-l-4 border-white'
          : 'text-white/70 hover:bg-white/5 hover:text-white'
        } ${isCollapsed ? 'justify-center px-2' : ''}`}
    >
      <span className="material-icons text-sm">{icon}</span>
      {!isCollapsed && <span className="text-sm font-medium whitespace-nowrap">{label}</span>}
    </button>
  );

  return (
    <div className="flex h-screen bg-secondary overflow-hidden">
      {/* Sidebar - No Print */}
      <aside className={`${isCollapsed ? 'w-20' : 'w-64'} bg-primary flex flex-col shadow-xl z-20 no-print transition-all duration-300 ease-in-out`}>
        <div className={`p-4 flex items-center ${isCollapsed ? 'justify-center py-6' : 'justify-between border-b border-white/10'}`}>
          {!isCollapsed && (
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center text-white flex-shrink-0">
                <span className="material-icons">security</span>
              </div>
              <div className="overflow-hidden">
                <h1 className="text-white font-bold text-lg tracking-tight truncate">GuardManager</h1>
                <p className="text-white/50 text-xs truncate">Offline Desktop</p>
              </div>
            </div>
          )}
          <button 
            onClick={toggleSidebar}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <span className="material-icons">{isCollapsed ? 'menu_open' : 'menu'}</span>
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <NavItem view="DASHBOARD" icon="dashboard" label="Dashboard" />
          <NavItem view="GUARDS" icon="people" label="Employees" />
          <NavItem view="SITES" icon="domain" label="Sites" />
          <NavItem view="ATTENDANCE" icon="assignment_turned_in" label="Shift Attendance" />
          <NavItem view="EXPENSES" icon="receipt_long" label="Expenses & Adv." />
          <NavItem view="SALARY" icon="payments" label="Salary Report" />
          <NavItem view="INVOICE" icon="receipt" label="Invoice" />
          <NavItem view="ACCOUNTS" icon="account_balance_wallet" label="Accounts" />
          <NavItem view="SETTINGS" icon="settings" label="Settings" />
        </nav>

        {!isCollapsed && (
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                AD
              </div>
              <div className="overflow-hidden">
                <p className="text-white text-sm font-medium truncate">Admin User</p>
                <p className="text-white/50 text-xs truncate">Local System</p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {children}
      </main>
    </div>
  );
};
