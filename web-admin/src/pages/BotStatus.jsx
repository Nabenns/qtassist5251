import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { Activity } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState.jsx';

export default function BotStatus() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Bot Status"
        description="Monitoring uptime, gateway ping, guild count, dan cron jobs."
      />
      <Card>
        <CardBody>
          <EmptyState
            icon={Activity}
            title="Coming up next"
            description="Live metrics akan tersedia di phase berikutnya."
          />
        </CardBody>
      </Card>
    </div>
  );
}
