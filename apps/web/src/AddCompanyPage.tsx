import { useState, type FormEvent, type DragEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { apiFetch } from './api';
import { useAuth } from './auth';
import { isPlatformRole } from './types';

export function AddCompanyPage() {
  const { session, refreshCompanies } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  if (!session || !isPlatformRole(session.user.role)) {
    return <Navigate to="/companies" replace />;
  }

  function pickFile(next: File | null) {
    if (!next) {
      setFile(null);
      return;
    }
    if (!next.name.toLowerCase().endsWith('.txt')) {
      setError('Only .txt guideline files are supported');
      return;
    }
    setError(null);
    setFile(next);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    pickFile(event.dataTransfer.files?.[0] ?? null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append('name', name.trim());
      if (file) {
        body.append('file', file);
      }
      await apiFetch('/companies', { method: 'POST', body });
      await refreshCompanies();
      navigate('/companies');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create company');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Add New Company</h1>
        <p className="mt-1 text-sm text-muted-strong">
          Add a new company and upload its support guidelines
        </p>
      </div>

      <div className="bg-surface shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <form onSubmit={onSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="company-name"
                className="block text-sm font-medium text-muted-strong"
              >
                Company Name
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="company-name"
                  id="company-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.currentTarget.value)}
                  className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-border-strong rounded-md border px-3 py-2"
                  placeholder="Enter company name"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-strong">
                Guidelines File
              </label>
              <div
                className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md ${
                  dragOver
                    ? 'border-primary bg-primary/10'
                    : 'border-border-strong'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                <div className="space-y-1 text-center">
                  <i
                    className="fas fa-file-alt mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 text-4xl"
                    aria-hidden="true"
                  />
                  <div className="flex text-sm text-muted-strong justify-center">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer bg-surface rounded-md font-medium text-primary hover:text-primary-hover focus-within:outline-none"
                    >
                      <span>Upload a file</span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        className="sr-only"
                        accept=".txt,text/plain"
                        onChange={(e) =>
                          pickFile(e.currentTarget.files?.[0] ?? null)
                        }
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-muted">TXT file up to 10MB</p>
                  {file && (
                    <p className="text-sm text-muted-strong pt-2">
                      Selected: <span className="font-medium">{file.name}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/60 text-red-700 dark:text-red-300 text-sm px-4 py-3">
                {error}
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <Link
                to="/companies"
                className="inline-flex justify-center py-2 px-4 border border-border-strong shadow-sm text-sm font-medium rounded-md text-muted-strong bg-surface hover:bg-bg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting || !name.trim()}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-60"
              >
                {submitting ? 'Saving…' : 'Add Company'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
