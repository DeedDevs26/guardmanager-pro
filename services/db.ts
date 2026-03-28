import { Guard, Site, AttendanceRecord, ExpenseRecord, Invoice } from '../types';

/**
 * A simple LocalStorage wrapper to simulate a SQL-like database offline.
 * In a real desktop app, this would connect to SQLite.
 */

const STORAGE_KEYS = {
  GUARDS: 'gmp_guards',
  SITES: 'gmp_sites',
  ATTENDANCE: 'gmp_attendance',
  EXPENSES: 'gmp_expenses',
  INVOICES: 'gmp_invoices',
  INIT: 'gmp_init'
};

// Seed Data
const seedData = () => {
  if (localStorage.getItem(STORAGE_KEYS.INIT)) return;

  const sites: Site[] = [
    { id: 's1', name: 'North Warehouse', clientName: 'Logistics Corp', contactNumber: '9876543210', location: 'Industrial Area A' },
    { id: 's2', name: 'City Mall', clientName: 'Retail Giants', contactNumber: '9123456780', location: 'City Center' },
  ];

  const guards: Guard[] = [
    { id: 'g1', name: 'Rajesh Kumar', code: 'SG-101', phone: '9988776655', aadhaar: '1234-5678-9012', siteId: 's1', salaryPerShift: 600, foodCostPerShift: 50, uniformDeduction: 0, joiningDate: '2023-01-15', status: 'Active' },
    { id: 'g2', name: 'Amit Singh', code: 'SG-102', phone: '8877665544', aadhaar: '5678-1234-9012', siteId: 's1', salaryPerShift: 550, foodCostPerShift: 50, uniformDeduction: 100, joiningDate: '2023-03-10', status: 'Active' },
    { id: 'g3', name: 'Suresh Patil', code: 'SG-103', phone: '7766554433', aadhaar: '9012-5678-1234', siteId: 's2', salaryPerShift: 700, foodCostPerShift: 60, uniformDeduction: 0, joiningDate: '2023-06-20', status: 'Active' },
  ];

  localStorage.setItem(STORAGE_KEYS.SITES, JSON.stringify(sites));
  localStorage.setItem(STORAGE_KEYS.GUARDS, JSON.stringify(guards));
  localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.INIT, 'true');
};

seedData();

// Generic Helper
const getCollection = <T>(key: string): T[] => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const saveCollection = <T>(key: string, data: T[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// --- API ---

export const db = {
  guards: {
    getAll: () => getCollection<Guard>(STORAGE_KEYS.GUARDS),
    add: (guard: Guard) => {
      const list = getCollection<Guard>(STORAGE_KEYS.GUARDS);
      list.push(guard);
      saveCollection(STORAGE_KEYS.GUARDS, list);
    },
    update: (guard: Guard) => {
      const list = getCollection<Guard>(STORAGE_KEYS.GUARDS);
      const idx = list.findIndex(g => g.id === guard.id);
      if (idx !== -1) {
        list[idx] = guard;
        saveCollection(STORAGE_KEYS.GUARDS, list);
      }
    },
    delete: (id: string) => {
      const list = getCollection<Guard>(STORAGE_KEYS.GUARDS);
      saveCollection(STORAGE_KEYS.GUARDS, list.filter(g => g.id !== id));
    }
  },
  sites: {
    getAll: () => getCollection<Site>(STORAGE_KEYS.SITES),
    add: (site: Site) => {
      const list = getCollection<Site>(STORAGE_KEYS.SITES);
      list.push(site);
      saveCollection(STORAGE_KEYS.SITES, list);
    },
    delete: (id: string) => {
      const list = getCollection<Site>(STORAGE_KEYS.SITES);
      saveCollection(STORAGE_KEYS.SITES, list.filter(s => s.id !== id));
    }
  },
  attendance: {
    getAll: () => getCollection<AttendanceRecord>(STORAGE_KEYS.ATTENDANCE),
    getByDateAndSite: (date: string, siteId: string) => {
      const all = getCollection<AttendanceRecord>(STORAGE_KEYS.ATTENDANCE);
      return all.filter(r => r.date === date && r.siteId === siteId);
    },
    saveRecord: (record: AttendanceRecord) => {
      const list = getCollection<AttendanceRecord>(STORAGE_KEYS.ATTENDANCE);
      const idx = list.findIndex(r => r.guardId === record.guardId && r.date === record.date);
      if (idx !== -1) {
        list[idx] = record;
      } else {
        list.push(record);
      }
      saveCollection(STORAGE_KEYS.ATTENDANCE, list);
    }
  },
  expenses: {
    getAll: () => getCollection<ExpenseRecord>(STORAGE_KEYS.EXPENSES),
    add: (expense: ExpenseRecord) => {
      const list = getCollection<ExpenseRecord>(STORAGE_KEYS.EXPENSES);
      list.push(expense);
      saveCollection(STORAGE_KEYS.EXPENSES, list);
    },
    delete: (id: string) => {
      const list = getCollection<ExpenseRecord>(STORAGE_KEYS.EXPENSES);
      saveCollection(STORAGE_KEYS.EXPENSES, list.filter(e => e.id !== id));
    }
  },
  invoices: {
    getAll: () => getCollection<Invoice>(STORAGE_KEYS.INVOICES),
    add: (invoice: Invoice) => {
      const list = getCollection<Invoice>(STORAGE_KEYS.INVOICES);
      list.push(invoice);
      saveCollection(STORAGE_KEYS.INVOICES, list);
    },
    delete: (id: string) => {
      const list = getCollection<Invoice>(STORAGE_KEYS.INVOICES);
      saveCollection(STORAGE_KEYS.INVOICES, list.filter(i => i.id !== id));
    }
  }
};