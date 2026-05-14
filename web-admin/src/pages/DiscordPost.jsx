import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { Send } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState.jsx';

export default function DiscordPost() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Discord Posts"
        description="Trigger setup commands (shop, my-info, role-claim, email) dari sini tanpa buka Discord."
      />
      <Card>
        <CardBody>
          <EmptyState
            icon={Send}
            title="Coming up next"
            description="Posting forms akan tersedia di phase berikutnya."
          />
        </CardBody>
      </Card>
    </div>
  );
}
