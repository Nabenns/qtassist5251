const express = require('express');
const { ChannelType } = require('discord.js');
const { requireAuth } = require('../middleware');

/**
 * Discord helper endpoints for the dashboard.
 *
 * - GET /api/discord/guilds          List of guilds the bot is in
 * - GET /api/discord/guilds/:id      Single guild details (member count, icon, owner, etc.)
 * - GET /api/discord/guilds/:id/channels   Text channels in a guild
 * - GET /api/discord/guilds/:id/roles      Roles in a guild (excludes @everyone, sorted by position desc)
 */

function buildRouter({ getDiscordClient }) {
  const router = express.Router();
  router.use(requireAuth);

  /**
   * Helper: resolve a Discord client or 503.
   */
  function client(res) {
    const c = getDiscordClient();
    if (!c) {
      res.status(503).json({ error: 'bot_not_ready' });
      return null;
    }
    return c;
  }

  router.get('/guilds', async (req, res) => {
    try {
      const c = client(res);
      if (!c) return;
      const guilds = c.guilds.cache.map((g) => ({
        id: g.id,
        name: g.name,
        memberCount: g.memberCount,
        iconURL: g.iconURL({ extension: 'png', size: 128 }) || null
      }));
      res.json({ items: guilds });
    } catch (error) {
      console.error('GET /api/discord/guilds error:', error);
      res.status(500).json({ error: 'internal_error' });
    }
  });

  router.get('/guilds/:id', async (req, res) => {
    try {
      const c = client(res);
      if (!c) return;
      const guild = await c.guilds.fetch(req.params.id).catch(() => null);
      if (!guild) return res.status(404).json({ error: 'not_found' });
      const owner = await guild.fetchOwner().catch(() => null);
      res.json({
        id: guild.id,
        name: guild.name,
        memberCount: guild.memberCount,
        iconURL: guild.iconURL({ extension: 'png', size: 256 }) || null,
        ownerId: guild.ownerId,
        ownerTag: owner ? owner.user.tag : null,
        createdAt: guild.createdAt
      });
    } catch (error) {
      console.error('GET /api/discord/guilds/:id error:', error);
      res.status(500).json({ error: 'internal_error' });
    }
  });

  router.get('/guilds/:id/channels', async (req, res) => {
    try {
      const c = client(res);
      if (!c) return;
      const guild = await c.guilds.fetch(req.params.id).catch(() => null);
      if (!guild) return res.status(404).json({ error: 'not_found' });

      // Refresh channel cache
      const channels = await guild.channels.fetch().catch(() => guild.channels.cache);

      const items = [];
      channels.forEach((ch) => {
        if (!ch) return;
        // Only text-style channels are useful for "post message" features.
        if (
          ch.type === ChannelType.GuildText ||
          ch.type === ChannelType.GuildAnnouncement ||
          ch.type === ChannelType.GuildForum ||
          ch.type === ChannelType.PublicThread ||
          ch.type === ChannelType.PrivateThread ||
          ch.type === ChannelType.AnnouncementThread
        ) {
          items.push({
            id: ch.id,
            name: ch.name,
            type: ch.type,
            parentId: ch.parentId || null,
            position: ch.position ?? 0
          });
        }
      });

      items.sort((a, b) => a.position - b.position);
      res.json({ items });
    } catch (error) {
      console.error('GET /api/discord/guilds/:id/channels error:', error);
      res.status(500).json({ error: 'internal_error' });
    }
  });

  router.get('/guilds/:id/roles', async (req, res) => {
    try {
      const c = client(res);
      if (!c) return;
      const guild = await c.guilds.fetch(req.params.id).catch(() => null);
      if (!guild) return res.status(404).json({ error: 'not_found' });

      // Refresh role cache
      const roles = await guild.roles.fetch().catch(() => guild.roles.cache);

      const botMember = await guild.members.fetchMe().catch(() => null);
      const botHighest = botMember ? botMember.roles.highest.position : 0;

      const items = [];
      roles.forEach((role) => {
        if (!role) return;
        // Skip the @everyone role (id matches guild id)
        if (role.id === guild.id) return;
        items.push({
          id: role.id,
          name: role.name,
          color: role.color,
          position: role.position,
          managed: role.managed,
          mentionable: role.mentionable,
          // Tells the UI whether the bot can actually assign this role.
          assignable: !role.managed && role.position < botHighest
        });
      });

      items.sort((a, b) => b.position - a.position);
      res.json({ items, botHighestPosition: botHighest });
    } catch (error) {
      console.error('GET /api/discord/guilds/:id/roles error:', error);
      res.status(500).json({ error: 'internal_error' });
    }
  });

  router.get('/users/:userId', async (req, res) => {
    try {
      const c = client(res);
      if (!c) return;
      const user = await c.users.fetch(req.params.userId).catch(() => null);
      if (!user) return res.status(404).json({ error: 'not_found' });
      res.json({
        id: user.id,
        username: user.username,
        globalName: user.globalName || null,
        tag: user.tag,
        avatarURL: user.displayAvatarURL({ extension: 'png', size: 128 })
      });
    } catch (error) {
      console.error('GET /api/discord/users/:userId error:', error);
      res.status(500).json({ error: 'internal_error' });
    }
  });

  return router;
}

module.exports = buildRouter;
