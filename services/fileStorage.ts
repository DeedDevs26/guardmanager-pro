import { postForm } from './api';

export const fileStorage = {
  async saveGuardFiles(guardName: string, guardId: string, files: { [key: string]: File | File[] | null }) {
    for (const [key, value] of Object.entries(files)) {
      if (!value) continue;
      const fileList = Array.isArray(value) ? value : [value];
      const documentType = key.replace('idProof', '').toLowerCase() || 'other';
      const formData = new FormData();
      formData.append('guardId', guardId);
      formData.append('guardName', guardName);
      formData.append('documentType', documentType);
      fileList.forEach(file => formData.append('files', file));
      await postForm('/api/documents/upload', formData);
    }
  }
};
