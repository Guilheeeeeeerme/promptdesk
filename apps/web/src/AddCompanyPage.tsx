import { useState, type FormEvent, type DragEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  Button,
  FileIcon,
  Input,
  Label,
  PageHeader,
  Panel,
  cn,
} from '@shared/ui';
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
      setFeedback({
        tone: 'error',
        message: t('Only .txt guideline files are supported.'),
      });
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
      const message =
        err instanceof Error ? err.message : t('Failed to create company');
      setError(message);
      setFeedback({ tone: 'error', message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t('Add New Company')}
        description={t('Add a new company and upload its support guidelines')}
      />

      <Panel>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-1.25">
            <Label htmlFor="company-name">{t('Company Name')}</Label>
            <Input
              type="text"
              name="company-name"
              id="company-name"
              required
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder={t('Enter company name')}
            />
          </div>

          <div className="space-y-1.25">
            <Label>{t('Guidelines File')}</Label>
            <div
              className={cn(
                'mt-1 flex justify-center rounded-md border border-dashed px-6 py-8',
                dragOver
                  ? 'border-accent bg-accent-muted'
                  : 'border-line bg-surface-sunken',
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <div className="space-y-2 text-center">
                <FileIcon className="mx-auto size-8 text-ink-tertiary" />
                <div className="flex justify-center text-14 text-ink-secondary">
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer font-medium text-accent hover:text-accent-hover"
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
                  <p className="ps-1">{t('or drag and drop')}</p>
                </div>
                <p className="text-12 text-ink-tertiary">
                  {t('TXT file up to 10MB')}
                </p>
                {file && (
                  <p className="pt-2 text-14 text-ink-primary">
                    {t('Selected: {name}').replace('{name}', file.name)}
                  </p>
                )}
              </div>
            </div>
          </div>

          <FeedbackBanner
            feedback={
              feedback ?? (error ? { tone: 'error', message: error } : null)
            }
          />

          <div className="flex justify-end gap-2">
            <Link to="/companies">
              <Button variant="secondary" type="button">
                {t('Cancel')}
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={submitting || !name.trim()}
            >
              {submitting ? t('Saving…') : t('Add Company')}
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
