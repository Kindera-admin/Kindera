'use client';

import Link from 'next/link';

// A multi-select of companies built from checkboxes in a scrollable box.
// options: [{ id, name, archived? }]; selected: array of ids; onChange(nextIds).
export default function CompanyCheckboxList({ legend, hint, options, selected, onChange }) {
  const toggle = (id, checked) => {
    onChange(checked ? [...selected, id] : selected.filter((s) => s !== id));
  };

  return (
    <fieldset className="space-y-1">
      <legend className="text-sm font-medium leading-none">{legend}</legend>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
      {options.length === 0 ? (
        <p className="rounded-md border bg-white px-3 py-3 text-sm text-gray-500">
          No companies yet. Add one on the{' '}
          <Link href="/admin/companies" className="text-blue-600 underline">Companies page</Link>.
        </p>
      ) : (
        <div className="max-h-48 overflow-y-auto rounded-md border bg-white">
          {options.map((option) => (
            <label
              key={option.id}
              className="flex min-h-[44px] cursor-pointer items-center gap-3 px-3 text-sm hover:bg-gray-50 has-[:focus-visible]:bg-gray-50"
            >
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 accent-[var(--brand)]"
                checked={selected.includes(option.id)}
                onChange={(e) => toggle(option.id, e.target.checked)}
              />
              <span className="min-w-0 break-words">
                {option.name}
                {option.archived && <span className="ml-1 text-xs text-gray-500">(archived)</span>}
              </span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
