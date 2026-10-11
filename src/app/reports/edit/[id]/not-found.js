import { FileQuestion } from 'lucide-react';
import StatusPage from '@/components/StatusPage';

export const metadata = { title: 'Report not found · Kindera' };

export default function ReportNotFound() {
  return (
    <StatusPage
      icon={FileQuestion}
      title="We couldn't find that report."
      message="It may have been removed, or you may not have access to it."
      actions={[
        { label: 'Back to reports', href: '/reports' },
        { label: 'Open dashboard', href: '/dashboard' },
      ]}
      code="Error 404"
    />
  );
}
