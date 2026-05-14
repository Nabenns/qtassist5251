import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, Mail } from 'lucide-react';
import { api, formatDateTime } from '../api.js';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input, FormField } from '../components/ui/Input.jsx';
import {
  DataTable,
  THead,
  TBody,
  TR,
  TH,
  TD,
  TableLoading,
  TableEmpty
} from '../components/ui/Table.jsx';

export default function Emails() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/emails?limit=200');
      setItems(res.items);
      setTotal(res.total);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load email bindings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const term = search.trim().toLowerCase();
    return items.filter(
      (b) =>
        (b.email || '').toLowerCase().includes(term) ||
        (b.userId || '').toLowerCase().includes(term)
    );
  }, [items, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daftar Email"
        description={`${total} total email terdaftar.`}
        actions={
          <div className="flex items-center gap-2">
            <FormField className="min-w-[260px]">
              <Input
                leadingIcon={Search}
                placeholder="Cari email atau user ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </FormField>
            <Button
              variant="secondary"
              onClick={load}
              loading={loading}
              leadingIcon={RefreshCw}
            >
              Muat ulang
            </Button>
          </div>
        }
      />

      {error ? (
        <div className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger ring-1 ring-inset ring-danger/30">
          {error}
        </div>
      ) : null}

      <Card>
        <DataTable>
          <THead>
            <TR>
              <TH>Email</TH>
              <TH>User ID</TH>
              <TH>Server ID</TH>
              <TH>Didaftarkan</TH>
              <TH>Diperbarui</TH>
            </TR>
          </THead>
          {loading ? (
            <TableLoading columns={5} rows={5} />
          ) : filtered.length === 0 ? (
            <TableEmpty
              columns={5}
              icon={Mail}
              title={items.length === 0 ? 'Belum ada email' : 'Tidak ada hasil'}
              description={
                items.length === 0
                  ? 'Email akan muncul saat user mendaftar lewat /email-setup di Discord.'
                  : 'Tidak ada email yang cocok dengan filter ini.'
              }
            />
          ) : (
            <TBody>
              {filtered.map((b) => (
                <TR key={b.id}>
                  <TD>{b.email}</TD>
                  <TD className="font-mono text-xs">{b.userId}</TD>
                  <TD className="font-mono text-xs">{b.serverId}</TD>
                  <TD className="text-muted-fg">{formatDateTime(b.registeredAt)}</TD>
                  <TD className="text-muted-fg">{formatDateTime(b.updatedAt)}</TD>
                </TR>
              ))}
            </TBody>
          )}
        </DataTable>
      </Card>
    </div>
  );
}
