import { AccountRecord, AttendanceRecord, BankOption, BootstrapData, ExpenseRecord, Guard, Invoice, Site } from '../types';
import { delJson, getJson, putJson } from './api';

type Cache = BootstrapData;

const cache: Cache = {
  guards: [],
  sites: [],
  attendance: [],
  expenses: [],
  invoices: [],
  accounts: [],
  banks: [],
};

let initialized = false;

function replaceAll(data: BootstrapData) {
  cache.guards = data.guards;
  cache.sites = data.sites;
  cache.attendance = data.attendance;
  cache.expenses = data.expenses;
  cache.invoices = data.invoices;
  cache.accounts = data.accounts;
  cache.banks = data.banks;
}

function upsertById<T extends { id: string }>(items: T[], next: T) {
  const idx = items.findIndex(item => item.id === next.id);
  if (idx === -1) {
    items.push(next);
    return;
  }
  items[idx] = next;
}

export const db = {
  async init() {
    if (initialized) return;
    const bootstrap = await getJson<BootstrapData>('/api/bootstrap');
    replaceAll(bootstrap);
    initialized = true;
  },
  guards: {
    getAll: () => cache.guards,
    add: async (guard: Guard) => {
      upsertById(cache.guards, guard);
      await putJson(`/api/guards/${guard.id}`, guard);
    },
    update: async (guard: Guard) => {
      upsertById(cache.guards, guard);
      await putJson(`/api/guards/${guard.id}`, guard);
    },
    delete: async (id: string) => {
      cache.guards = cache.guards.filter(guard => guard.id !== id);
      await delJson(`/api/guards/${id}`);
    }
  },
  sites: {
    getAll: () => cache.sites,
    add: async (site: Site) => {
      upsertById(cache.sites, site);
      await putJson(`/api/sites/${site.id}`, site);
    },
    update: async (site: Site) => {
      upsertById(cache.sites, site);
      await putJson(`/api/sites/${site.id}`, site);
    },
    delete: async (id: string) => {
      cache.sites = cache.sites.filter(site => site.id !== id);
      await delJson(`/api/sites/${id}`);
    }
  },
  attendance: {
    getAll: () => cache.attendance,
    getByDateAndSite: (date: string, siteId: string) => cache.attendance.filter(record => record.date === date && record.siteIds.includes(siteId)),
    saveRecord: async (record: AttendanceRecord) => {
      const recordId = record.id || `${record.guardId}_${record.date}`;
      const nextRecord = { ...record, id: recordId };
      const idx = cache.attendance.findIndex(item => item.guardId === record.guardId && item.date === record.date);
      if (idx === -1) {
        cache.attendance.push(nextRecord);
      } else {
        cache.attendance[idx] = nextRecord;
      }
      await putJson(`/api/attendance/${recordId}`, nextRecord);
    }
  },
  expenses: {
    getAll: () => cache.expenses,
    add: async (expense: ExpenseRecord) => {
      upsertById(cache.expenses, expense);
      await putJson(`/api/expenses/${expense.id}`, expense);
    },
    delete: async (id: string) => {
      cache.expenses = cache.expenses.filter(expense => expense.id !== id);
      await delJson(`/api/expenses/${id}`);
    }
  },
  invoices: {
    getAll: () => cache.invoices,
    add: async (invoice: Invoice) => {
      upsertById(cache.invoices, invoice);
      await putJson(`/api/invoices/${invoice.id}`, invoice);
    },
    delete: async (id: string) => {
      cache.invoices = cache.invoices.filter(invoice => invoice.id !== id);
      await delJson(`/api/invoices/${id}`);
    }
  },
  banks: {
    getAll: () => cache.banks,
    add: async (bank: BankOption) => {
      upsertById(cache.banks, bank);
      await putJson(`/api/banks/${bank.id}`, bank);
    },
    delete: async (id: string) => {
      cache.banks = cache.banks.filter(bank => bank.id !== id);
      await delJson(`/api/banks/${id}`);
    }
  },
  accounts: {
    getAll: () => cache.accounts.slice().sort((a, b) => b.date.localeCompare(a.date)),
    add: async (record: AccountRecord) => {
      upsertById(cache.accounts, record);
      await putJson(`/api/accounts/${record.id}`, record);
    },
    delete: async (id: string) => {
      cache.accounts = cache.accounts.filter(record => record.id !== id);
      await delJson(`/api/accounts/${id}`);
    }
  }
};
