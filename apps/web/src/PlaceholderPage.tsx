import { EmptyState, PageHeader, Panel } from '@shared/ui';
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
      <PageHeader title={t(title)} description={t(description)} />
      <Panel padded={false}>
        <EmptyState title={t('This section is not available yet.')} />
      </Panel>
    </div>
  );
}
