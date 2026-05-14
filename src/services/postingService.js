/**
 * Shared "post a setup message to a Discord channel" service.
 * Consumed by both the slash commands and the admin web dashboard so the
 * resulting embeds and button layouts stay identical regardless of where
 * the action originated.
 */

const {
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');
const { Product } = require('../database/models');
const { formatDuration } = require('../utils/parseDuration');
const {
  createSuccessEmbed,
  createErrorEmbed,
  QTRADES_LOGO_URL,
  COLORS
} = require('../utils/embedBuilder');

const BUTTON_STYLE_MAP = {
  primary: ButtonStyle.Primary,
  success: ButtonStyle.Success,
  secondary: ButtonStyle.Secondary,
  danger: ButtonStyle.Danger
};

function fail(code, message) {
  return { ok: false, code, message };
}

async function resolveTextChannel(client, guildId, channelId) {
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return { error: fail('guild_not_found', 'Guild not accessible') };

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel) return { error: fail('channel_not_found', 'Channel not found') };

  const textTypes = [
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
    ChannelType.PublicThread,
    ChannelType.PrivateThread,
    ChannelType.AnnouncementThread
  ];
  if (!textTypes.includes(channel.type)) {
    return { error: fail('invalid_channel_type', 'Channel must be a text channel') };
  }

  // Verify bot can send messages here
  const me = await guild.members.fetchMe().catch(() => null);
  if (!me) return { error: fail('bot_not_in_guild', 'Bot is not a member of this guild') };
  const perms = channel.permissionsFor(me);
  if (
    !perms ||
    !perms.has(PermissionFlagsBits.ViewChannel) ||
    !perms.has(PermissionFlagsBits.SendMessages) ||
    !perms.has(PermissionFlagsBits.EmbedLinks)
  ) {
    return {
      error: fail(
        'missing_channel_permission',
        'Bot needs View Channel, Send Messages, and Embed Links in this channel'
      )
    };
  }

  return { guild, channel, me };
}

/**
 * Shop: list active products as embed fields and post one button per product.
 */
async function postShop({ client, guildId, channelId }) {
  const resolved = await resolveTextChannel(client, guildId, channelId);
  if (resolved.error) return resolved.error;
  const { guild, channel } = resolved;

  const products = await Product.findAll({
    where: { serverId: guildId, isActive: true },
    order: [['price', 'ASC']]
  });

  if (products.length === 0) {
    return fail(
      'no_active_products',
      'No active products configured for this guild. Create one with /product-create first.'
    );
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('🛒 QTrades Role Shop')
    .setDescription(
      'Purchase exclusive roles with various durations!\n\n**How to purchase:**\n' +
        '1. Click the button below for the role you want\n' +
        '2. Transfer to the provided bank account\n' +
        '3. Upload payment proof\n' +
        '4. Wait for admin approval\n' +
        '5. Role will be assigned after approval\n\n**Available Packages:**'
    )
    .setTimestamp();

  for (const p of products) {
    const role = guild.roles.cache.get(p.roleId);
    const formattedPrice = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(p.price);
    embed.addFields({
      name: p.name,
      value: `${role ? `<@&${role.id}>` : 'Unknown Role'}\n💰 **Price:** ${formattedPrice}\n⏱️ **Duration:** ${formatDuration(p.duration)}\n📝 ${p.description || ''}`,
      inline: false
    });
  }

  embed.setFooter({
    text: 'QTrades · Manual Bank Transfer',
    iconURL: QTRADES_LOGO_URL || guild.iconURL({ dynamic: true })
  });
  if (QTRADES_LOGO_URL) embed.setThumbnail(QTRADES_LOGO_URL);

  const buttons = [];
  for (let i = 0; i < Math.min(products.length, 25); i++) {
    const p = products[i];
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`buy_product_${p.id}`)
        .setLabel(`Buy ${p.name.length > 60 ? p.name.slice(0, 57) + '...' : p.name}`)
        .setStyle(ButtonStyle.Success)
        .setEmoji('💳')
    );
  }
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }

  const message = await channel.send({ embeds: [embed], components: rows });
  return { ok: true, messageId: message.id, channelId: channel.id };
}

/**
 * My Info: a single embed with two buttons (myinfo_roles, myinfo_purchases).
 */
async function postMyInfo({ client, guildId, channelId }) {
  const resolved = await resolveTextChannel(client, guildId, channelId);
  if (resolved.error) return resolved.error;
  const { guild, channel } = resolved;

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('👤 My Info')
    .setDescription(
      'Cek informasi akun kamu di server ini.\n\n' +
        '**Pilih salah satu tombol di bawah:**\n' +
        '🎭 **Cek Role** — Lihat role temporary aktif kamu beserta sisa durasinya\n' +
        '🛒 **Riwayat Pembelian** — Lihat history transaksi & pembelian kamu\n\n' +
        'Hasil hanya akan terlihat oleh kamu sendiri (ephemeral).'
    )
    .setTimestamp();

  embed.setFooter({
    text: 'QTrades · Personal Account Info',
    iconURL: QTRADES_LOGO_URL || guild.iconURL({ dynamic: true })
  });
  if (QTRADES_LOGO_URL) embed.setThumbnail(QTRADES_LOGO_URL);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('myinfo_roles')
      .setLabel('Cek Role')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎭'),
    new ButtonBuilder()
      .setCustomId('myinfo_purchases')
      .setLabel('Riwayat Pembelian')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🛒')
  );

  const message = await channel.send({ embeds: [embed], components: [row] });
  return { ok: true, messageId: message.id, channelId: channel.id };
}

/**
 * Role claim: 1..5 buttons, each gives the clicker a permanent role.
 * Mirrors the validation rules of /role-claim-setup.
 */
async function postRoleClaim({
  client,
  guildId,
  channelId,
  roleIds,
  title,
  description,
  buttonStyle = 'primary'
}) {
  const resolved = await resolveTextChannel(client, guildId, channelId);
  if (resolved.error) return resolved.error;
  const { guild, me } = resolved;

  if (!Array.isArray(roleIds) || roleIds.length === 0) {
    return fail('roles_required', 'At least one role is required');
  }
  if (roleIds.length > 5) {
    return fail('too_many_roles', 'Maximum 5 roles per claim message');
  }

  // Dedupe and resolve
  const seen = new Set();
  const roles = [];
  for (const id of roleIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const role = guild.roles.cache.get(id) || (await guild.roles.fetch(id).catch(() => null));
    if (!role) return fail('role_not_found', `Role ${id} not found in guild`);
    if (role.id === guild.id) return fail('invalid_role', '@everyone cannot be assigned');
    if (role.managed) return fail('invalid_role', `Role "${role.name}" is managed by an integration`);
    roles.push(role);
  }

  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return fail('missing_permission', 'Bot is missing the Manage Roles permission');
  }

  const botHighest = me.roles.highest.position;
  for (const role of roles) {
    if (role.position >= botHighest) {
      return fail(
        'role_above_bot',
        `Bot's highest role must be above "${role.name}". Move the bot's role up in Server Settings → Roles.`
      );
    }
  }

  const style = BUTTON_STYLE_MAP[buttonStyle] || ButtonStyle.Primary;

  const defaultDescription =
    roles.length === 1
      ? `Klik tombol di bawah untuk mendapatkan role <@&${roles[0].id}>.`
      : `Klik salah satu tombol di bawah untuk mendapatkan role yang kamu inginkan.\n\n**Role tersedia:**\n${roles
          .map((r) => `• <@&${r.id}>`)
          .join('\n')}`;

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(title || '🎯 Klaim Role')
    .setDescription((description || defaultDescription).replace(/\\n/g, '\n'))
    .setTimestamp();

  embed.setFooter({
    text: 'QTrades · Klik tombol untuk klaim role',
    iconURL: QTRADES_LOGO_URL || guild.iconURL({ dynamic: true })
  });
  if (QTRADES_LOGO_URL) embed.setThumbnail(QTRADES_LOGO_URL);

  const buttons = roles.map((role) =>
    new ButtonBuilder()
      .setCustomId(`claim_role_${role.id}`)
      .setLabel(role.name.length > 80 ? role.name.slice(0, 77) + '...' : role.name)
      .setStyle(style)
      .setEmoji('🎭')
  );

  const row = new ActionRowBuilder().addComponents(buttons);
  const message = await resolved.channel.send({ embeds: [embed], components: [row] });
  return { ok: true, messageId: message.id, channelId: resolved.channel.id };
}

/**
 * Email registration: posts the embed with the email_register button.
 * Optional: customize title and description.
 */
async function postEmailSignup({
  client,
  guildId,
  channelId,
  title,
  description,
  buttonLabel
}) {
  const resolved = await resolveTextChannel(client, guildId, channelId);
  if (resolved.error) return resolved.error;
  const { guild, channel } = resolved;

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(title || '📧 Daftarkan Email')
    .setDescription(
      (
        description ||
        'Daftarkan email kamu untuk dapat akses ke konten eksklusif (video pembelajaran, materi Drive, dsb).\n\n' +
          'Klik tombol di bawah, lalu masukkan email yang valid. Email ini akan otomatis di-share folder Drive yang sudah dikonfigurasi admin (jika fitur auto-share aktif).'
      ).replace(/\\n/g, '\n')
    )
    .setTimestamp();

  embed.setFooter({
    text: 'QTrades · Email Registration',
    iconURL: QTRADES_LOGO_URL || guild.iconURL({ dynamic: true })
  });
  if (QTRADES_LOGO_URL) embed.setThumbnail(QTRADES_LOGO_URL);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('email_register')
      .setLabel(buttonLabel || 'Daftar Email')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📧')
  );

  const message = await channel.send({ embeds: [embed], components: [row] });
  return { ok: true, messageId: message.id, channelId: channel.id };
}

module.exports = {
  postShop,
  postMyInfo,
  postRoleClaim,
  postEmailSignup
};
