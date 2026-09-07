import { useState, type FormEvent, type DragEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { apiFetch } from './api';
import { useAuth } from './auth';
import { isPlatformRole } from './types';
import { useLocale } from './locale';
import { FeedbackBanner, type Feedback } from './FeedbackBanner';

export function AddCompanyPage() {
  const { session, refreshCompanies } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
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
      setError(t('Only .txt guideline files are supported'));
      setFeedback({ tone: 'error', message: t('Only .txt guideline files are supported.') });
      return;
    }
    setError(null);
    setFeedback(null);
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
    setFeedback({ tone: 'info', message: t('Creating company…') });
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append('name', name.trim());
      if (file) {
        body.append('file', file);
      }
      await apiFetch('/companies', { method: 'POST', body });
      await refreshCompanies();
      navigate('/companies', {
        state: {
          feedback: {
            tone: 'success' as const,
            message: file
              ? t('Company created. Its guideline is active and ready to use.')
              : t('Company created successfully.'),
          },
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('Failed to create company');
      setError(message);
      setFeedback({ tone: 'error', message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t('Add New Company')}</h1>
        <p className="mt-1 text-sm text-gray-600">
          {t('Add a new company and upload its support guidelines')}
        </p>
      </div>

      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <form onSubmit={onSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="company-name"
                className="block text-sm font-medium text-gray-700"
              >
                {t('Company Name')}
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="company-name"
                  id="company-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.currentTarget.value)}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md border px-3 py-2"
                  placeholder={t('Enter company name')}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t('Guidelines File')}
              </label>
              <div
                className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md ${
                  dragOver
                    ? 'border-indigo-400 bg-indigo-50'
                    : 'border-gray-300'
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
                    className="fas fa-file-alt mx-auto h-12 w-12 text-gray-400 text-4xl"
                    aria-hidden="true"
                  />
                  <div className="flex text-sm text-gray-600 justify-center">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none"
                    >
                      <span>{t('Upload a file')}</span>
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
                    <p className="pl-1">{t('or drag and drop')}</p>
                  </div>
                  <p className="text-xs text-gray-500">{t('TXT file up to 10MB')}</p>
                  {file && (
                    <p className="text-sm text-gray-700 pt-2">
                      {t('Selected: {name}').replace('{name}', file.name)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <FeedbackBanner
              feedback={feedback ?? (error ? { tone: 'error', message: error } : null)}
            />

            <div className="flex justify-end space-x-3">
              <Link
                to="/companies"
                className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {t('Cancel')}
              </Link>
              <button
                type="submit"
                disabled={submitting || !name.trim()}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60"
              >
                {submitting ? t('Saving…') : t('Add Company')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
