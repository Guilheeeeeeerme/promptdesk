export function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">{title}</h1>
        <p className="mt-1 text-sm text-muted-strong">{description}</p>
      </div>
      <div className="bg-surface shadow rounded-lg p-6 text-muted-strong text-sm">
        This section is not available yet.
      </div>
    </div>
  );
}
