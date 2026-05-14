const express = require('express');
const { requireAuth } = require('../middleware');
const {
  postShop,
  postMyInfo,
  postRoleClaim,
  postEmailSignup
} = require('../../services/postingService');

/**
 * POST /api/discord-posts/shop          { guildId, channelId }
 * POST /api/discord-posts/my-info       { guildId, channelId }
 * POST /api/discord-posts/role-claim    { guildId, channelId, roleIds[], title?, description?, buttonStyle? }
 * POST /api/discord-posts/email-signup  { guildId, channelId, title?, description?, buttonLabel? }
 */

function buildRouter({ getDiscordClient }) {
  const router = express.Router();
  router.use(requireAuth);

  function client(res) {
    const c = getDiscordClient();
    if (!c) {
      res.status(503).json({ error: 'bot_not_ready' });
      return null;
    }
    return c;
  }

  function handle(result, res) {
    if (!result) {
      return res.status(500).json({ error: 'internal_error' });
    }
    if (!result.ok) {
      const status = result.code === 'guild_not_found' || result.code === 'channel_not_found' ? 404 : 400;
      return res.status(status).json({ error: result.code, message: result.message });
    }
    return res.json(result);
  }

  router.post('/shop', async (req, res) => {
    try {
      const c = client(res);
      if (!c) return;
      const { guildId, channelId } = req.body || {};
      if (!guildId || !channelId) {
        return res.status(400).json({ error: 'missing_fields' });
      }
      const result = await postShop({ client: c, guildId, channelId });
      return handle(result, res);
    } catch (error) {
      console.error('POST /api/discord-posts/shop error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  router.post('/my-info', async (req, res) => {
    try {
      const c = client(res);
      if (!c) return;
      const { guildId, channelId } = req.body || {};
      if (!guildId || !channelId) {
        return res.status(400).json({ error: 'missing_fields' });
      }
      const result = await postMyInfo({ client: c, guildId, channelId });
      return handle(result, res);
    } catch (error) {
      console.error('POST /api/discord-posts/my-info error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  router.post('/role-claim', async (req, res) => {
    try {
      const c = client(res);
      if (!c) return;
      const {
        guildId,
        channelId,
        roleIds,
        title,
        description,
        buttonStyle
      } = req.body || {};
      if (!guildId || !channelId) {
        return res.status(400).json({ error: 'missing_fields' });
      }
      const result = await postRoleClaim({
        client: c,
        guildId,
        channelId,
        roleIds,
        title,
        description,
        buttonStyle
      });
      return handle(result, res);
    } catch (error) {
      console.error('POST /api/discord-posts/role-claim error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  router.post('/email-signup', async (req, res) => {
    try {
      const c = client(res);
      if (!c) return;
      const { guildId, channelId, title, description, buttonLabel } = req.body || {};
      if (!guildId || !channelId) {
        return res.status(400).json({ error: 'missing_fields' });
      }
      const result = await postEmailSignup({
        client: c,
        guildId,
        channelId,
        title,
        description,
        buttonLabel
      });
      return handle(result, res);
    } catch (error) {
      console.error('POST /api/discord-posts/email-signup error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  return router;
}

module.exports = buildRouter;
