import React, { useState } from 'react';

interface FileUploadProps {
  label: string;
  onFileSelect: (file: File | null) => void;
  acceptedFormats?: string;
  initialFileName?: string;
  required?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ label, onFileSelect, acceptedFormats = "image/*,.pdf", initialFileName, required }) => {
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(initialFileName || null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setFileName(file.name);
      onFileSelect(file);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFileName(file.name);
      onFileSelect(file);
    }
  };

  const clearFile = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFileName(null);
    onFileSelect(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center w-full">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>
        {required && !fileName && (
          <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded leading-none">Required</span>
        )}
      </div>
      <div 
        className={`relative border-2 border-dashed rounded-xl p-4 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center min-h-[100px]
          ${dragActive ? 'border-primary bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'}
          ${fileName ? 'bg-slate-50' : 'bg-white'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {fileName ? (
          <div className="flex items-center gap-3 w-full relative z-10">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
              <span className="material-icons">{fileName.toLowerCase().endsWith('.pdf') ? 'picture_as_pdf' : 'image'}</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-slate-700 truncate">{fileName}</p>
              <p className="text-[10px] text-slate-400">File attached</p>
            </div>
            <button 
              type="button"
              onClick={clearFile}
              className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-colors relative z-20"
            >
              <span className="material-icons text-sm">close</span>
            </button>
          </div>
        ) : (
          <>
            <input 
              type="file" 
              id={label}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
              accept={acceptedFormats}
              onChange={handleChange}
            />
            <div className="text-center">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-2">
                <span className="material-icons">cloud_upload</span>
              </div>
              <p className="text-sm text-slate-500"><span className="text-primary font-bold">Click to upload</span> or drag and drop</p>
              <p className="text-[10px] text-slate-400 mt-1">PDF, PNG, JPG (max 5MB)</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
