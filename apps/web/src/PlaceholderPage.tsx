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
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="mt-1 text-sm text-gray-600">{description}</p>
      </div>
      <div className="bg-white shadow rounded-lg p-6 text-gray-600 text-sm">
        This section is not available yet.
      </div>
    </div>
  );
}
