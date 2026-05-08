import { InboxIcon } from '@heroicons/react/24/outline';

export default function EmptyState({ title = 'No results', description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <InboxIcon className="w-12 h-12 text-gray-300 mb-4" />
      <h3 className="text-gray-700 font-medium">{title}</h3>
      {description && <p className="text-sm text-gray-400 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
