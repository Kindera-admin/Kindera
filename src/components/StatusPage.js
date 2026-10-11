import Link from 'next/link';
import { Button } from '@/components/ui/button';

// Shared layout for 404 and error pages. `actions` render in order; the first
// is the primary (Evergreen) button. An action has either `href` (a link) or
// `onClick` (only from client components such as error.js).
export default function StatusPage({ icon: Icon, title, message, actions = [], code }) {
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      {Icon && (
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand-tint text-brand">
          <Icon className="h-7 w-7" aria-hidden="true" />
        </div>
      )}
      <h1 className="max-w-xl font-serif text-4xl leading-tight text-brand text-balance md:text-5xl">
        {title}
      </h1>
      <p className="mt-4 max-w-[42ch] text-base leading-relaxed text-gray-600">
        {message}
      </p>
      {actions.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {actions.map((action, i) => {
            const variant = i === 0 ? 'default' : 'outline';
            return action.href ? (
              <Button key={action.label} asChild variant={variant} size="lg">
                <Link href={action.href}>{action.label}</Link>
              </Button>
            ) : (
              <Button key={action.label} variant={variant} size="lg" onClick={action.onClick}>
                {action.label}
              </Button>
            );
          })}
        </div>
      )}
      {code && <p className="mt-10 text-xs text-gray-500">{code}</p>}
    </section>
  );
}
