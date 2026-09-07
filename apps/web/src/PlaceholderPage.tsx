import { useLocale } from './locale';

export function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const { t } = useLocale();
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t(title)}</h1>
        <p className="mt-1 text-sm text-gray-600">{t(description)}</p>
      </div>
      <div className="bg-white shadow rounded-lg p-6 text-gray-600 text-sm">
        {t('This section is not available yet.')}
      </div>
    </div>
  );
}
