import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { Search } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState.jsx';

export default function UserLookup() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="User Lookup"
        description="Lihat semua aktivitas user (transactions, temp roles, email) dari satu tempat."
      />
      <Card>
        <CardBody>
          <EmptyState
            icon={Search}
            title="Coming up next"
            description="Search by Discord User ID akan tersedia di phase berikutnya."
          />
        </CardBody>
      </Card>
    </div>
  );
}
