import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { ListChecks } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState.jsx';

export default function AuditLog() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Riwayat tindakan admin di Discord dan dashboard."
      />
      <Card>
        <CardBody>
          <EmptyState
            icon={ListChecks}
            title="Coming up next"
            description="Page ini akan diisi dengan moderation log filter di phase berikutnya."
          />
        </CardBody>
      </Card>
    </div>
  );
}
