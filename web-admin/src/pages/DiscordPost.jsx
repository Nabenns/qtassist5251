import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Send,
  ShoppingCart,
  UserCircle2,
  Tags,
  Mail,
  CheckCircle2
} from 'lucide-react';
import { api, ApiError } from '../api.js';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input, Select, Textarea, FormField } from '../components/ui/Input.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { cn } from '../lib/cn.js';

const TYPES = [
  { value: 'shop', label: 'Shop', icon: ShoppingCart, description: 'Post embed produk dengan tombol Beli untuk tiap produk aktif.' },
  { value: 'my-info', label: 'My Info', icon: UserCircle2, description: 'Post embed dengan 2 tombol: Cek Role + Riwayat Pembelian.' },
  { value: 'role-claim', label: 'Role Claim', icon: Tags, description: 'Post embed dengan tombol klaim role (max 5 role).' },
  { value: 'email-signup', label: 'Email Signup', icon: Mail, description: 'Post embed dengan tombol pendaftaran email.' }
];

export default function DiscordPost() {
  const { toast } = useToast();
  const [type, setType] = useState('shop');
  const [guilds, setGuilds] = useState([]);
  const [guildsLoading, setGuildsLoading] = useState(true);
  const [guildId, setGuildId] = useState('');
  const [channels, setChannels] = useState([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelId, setChannelId] = useState('');
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastPosted, setLastPosted] = useState(null);

  // Type-specific fields
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [buttonStyle, setButtonStyle] = useState('primary');
  const [buttonLabel, setButtonLabel] = useState('');

  // Load guilds once
  useEffect(() => {
    let cancelled = false;
    api
      .get('/api/discord/guilds')
      .then((res) => {
        if (cancelled) return;
        setGuilds(res.items || []);
        if ((res.items || []).length === 1) {
          setGuildId(res.items[0].id);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setGuildsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load channels + roles when guild changes
  useEffect(() => {
    if (!guildId) {
      setChannels([]);
      setRoles([]);
      setChannelId('');
      setSelectedRoleIds([]);
      return undefined;
    }
    let cancelled = false;
    setChannelsLoading(true);
    setRolesLoading(true);
    setChannelId('');
    setSelectedRoleIds([]);

    Promise.all([
      api.get(`/api/discord/guilds/${guildId}/channels`).then((r) => {
        if (!cancelled) {
          setChannels(r.items || []);
        }
      }).catch(() => {}),
      api.get(`/api/discord/guilds/${guildId}/roles`).then((r) => {
        if (!cancelled) setRoles(r.items || []);
      }).catch(() => {})
    ]).finally(() => {
      if (!cancelled) {
        setChannelsLoading(false);
        setRolesLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [guildId]);

  const canSubmit = useMemo(() => {
    if (!guildId || !channelId) return false;
    if (type === 'role-claim' && selectedRoleIds.length === 0) return false;
    return !submitting;
  }, [type, guildId, channelId, selectedRoleIds, submitting]);

  const toggleRole = useCallback((id) => {
    setSelectedRoleIds((current) => {
      const set = new Set(current);
      if (set.has(id)) set.delete(id);
      else if (set.size < 5) set.add(id);
      else return current; // cap at 5
      return Array.from(set);
    });
  }, []);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      let result;
      if (type === 'shop') {
        result = await api.post('/api/discord-posts/shop', { guildId, channelId });
      } else if (type === 'my-info') {
        result = await api.post('/api/discord-posts/my-info', { guildId, channelId });
      } else if (type === 'role-claim') {
        result = await api.post('/api/discord-posts/role-claim', {
          guildId,
          channelId,
          roleIds: selectedRoleIds,
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          buttonStyle
        });
      } else if (type === 'email-signup') {
        result = await api.post('/api/discord-posts/email-signup', {
          guildId,
          channelId,
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          buttonLabel: buttonLabel.trim() || undefined
        });
      }
      setLastPosted({
        type,
        ...result,
        guildId,
        channelId,
        guildName: guilds.find((g) => g.id === guildId)?.name,
        channelName: channels.find((c) => c.id === channelId)?.name,
        time: new Date()
      });
      toast.success('Pesan terkirim ke Discord');
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message || err.code || 'Gagal kirim' : 'Gagal kirim';
      toast.error('Gagal kirim ke Discord', { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  const TypeMeta = TYPES.find((t) => t.value === type) || TYPES[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Discord Posts"
        description="Kirim setup message (shop, my-info, role-claim, email signup) ke channel Discord tanpa buka Discord."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TYPES.map((t) => {
          const Icon = t.icon;
          const active = type === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setType(t.value);
                setLastPosted(null);
              }}
              className={cn(
                'group flex items-start gap-3 rounded-xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                active
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-border bg-surface text-fg hover:border-ring/40 hover:bg-surface-2'
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg',
                  active ? 'bg-primary text-primary-fg' : 'bg-surface-3 text-fg-muted'
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{t.label}</div>
                <div className={cn('text-xs', active ? 'text-primary' : 'text-muted-fg')}>
                  {t.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader title={TypeMeta.label} description={TypeMeta.description} />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Guild">
              <Select
                value={guildId}
                onChange={(e) => setGuildId(e.target.value)}
                disabled={guildsLoading}
              >
                <option value="">Pilih guild...</option>
                {guilds.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Channel">
              <Select
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                disabled={!guildId || channelsLoading}
              >
                <option value="">{guildId ? 'Pilih channel...' : 'Pilih guild dulu'}</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          {type === 'role-claim' ? (
            <RoleClaimFields
              roles={roles}
              rolesLoading={rolesLoading}
              selected={selectedRoleIds}
              onToggle={toggleRole}
              title={title}
              onTitle={setTitle}
              description={description}
              onDescription={setDescription}
              buttonStyle={buttonStyle}
              onButtonStyle={setButtonStyle}
            />
          ) : null}

          {type === 'email-signup' ? (
            <EmailSignupFields
              title={title}
              onTitle={setTitle}
              description={description}
              onDescription={setDescription}
              buttonLabel={buttonLabel}
              onButtonLabel={setButtonLabel}
            />
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <Button onClick={handleSubmit} loading={submitting} disabled={!canSubmit} leadingIcon={Send}>
              Kirim ke Discord
            </Button>
          </div>

          {lastPosted ? (
            <div className="rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-sm text-success">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>Terkirim ke #{lastPosted.channelName} di {lastPosted.guildName}</span>
              </div>
              <div className="mt-1 text-xs text-success/80">
                Message ID: <span className="font-mono">{lastPosted.messageId}</span>
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}

function RoleClaimFields({
  roles,
  rolesLoading,
  selected,
  onToggle,
  title,
  onTitle,
  description,
  onDescription,
  buttonStyle,
  onButtonStyle
}) {
  return (
    <div className="space-y-3">
      <FormField
        label={`Roles (${selected.length}/5 dipilih)`}
        hint="Klik untuk pilih, max 5. Role yang gak assignable disabled."
      >
        {rolesLoading ? (
          <div className="text-sm text-muted-fg">Loading roles...</div>
        ) : roles.length === 0 ? (
          <div className="text-sm text-muted-fg">Tidak ada role yang ditemukan.</div>
        ) : (
          <div className="flex max-h-72 flex-wrap gap-2 overflow-y-auto rounded-lg border border-border bg-surface-2 p-3">
            {roles.map((r) => {
              const active = selected.includes(r.id);
              const disabled = !r.assignable;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => !disabled && onToggle(r.id)}
                  disabled={disabled}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1 ring-inset transition',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                    active
                      ? 'bg-primary text-primary-fg ring-primary'
                      : disabled
                      ? 'bg-surface text-muted-fg ring-border opacity-60 cursor-not-allowed'
                      : 'bg-surface text-fg ring-border hover:bg-surface-3'
                  )}
                  title={
                    disabled
                      ? r.managed
                        ? 'Managed role / integration role tidak bisa di-assign'
                        : 'Role di atas posisi role bot'
                      : ''
                  }
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: r.color ? `#${r.color.toString(16).padStart(6, '0')}` : 'transparent' }}
                    aria-hidden="true"
                  />
                  {r.name}
                </button>
              );
            })}
          </div>
        )}
      </FormField>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="Title (opsional)">
          <Input value={title} onChange={(e) => onTitle(e.target.value)} placeholder="🎯 Klaim Role" />
        </FormField>
        <FormField label="Button style">
          <Select value={buttonStyle} onChange={(e) => onButtonStyle(e.target.value)}>
            <option value="primary">Primary (Blue)</option>
            <option value="success">Success (Green)</option>
            <option value="secondary">Secondary (Gray)</option>
            <option value="danger">Danger (Red)</option>
          </Select>
        </FormField>
      </div>
      <FormField label="Description (opsional)" hint="Pakai \\n untuk newline.">
        <Textarea
          value={description}
          onChange={(e) => onDescription(e.target.value)}
          placeholder="Klik salah satu tombol untuk klaim role..."
        />
      </FormField>
    </div>
  );
}

function EmailSignupFields({ title, onTitle, description, onDescription, buttonLabel, onButtonLabel }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FormField label="Title (opsional)">
        <Input
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          placeholder="📧 Daftarkan Email"
        />
      </FormField>
      <FormField label="Button label (opsional)">
        <Input
          value={buttonLabel}
          onChange={(e) => onButtonLabel(e.target.value)}
          placeholder="Daftar Email"
        />
      </FormField>
      <FormField label="Description (opsional)" className="md:col-span-2" hint="Pakai \\n untuk newline.">
        <Textarea
          value={description}
          onChange={(e) => onDescription(e.target.value)}
          placeholder="Daftarkan email kamu untuk dapat akses ke konten eksklusif..."
        />
      </FormField>
    </div>
  );
}
