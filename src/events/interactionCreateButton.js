const { Product, Transaction, TemporaryRole } = require('../database/models');
const { createTransaction } = require('../services/midtransService');
const { createSuccessEmbed, createErrorEmbed, createInfoEmbed, QTRADES_LOGO_URL } = require('../utils/embedBuilder');
const { formatDuration } = require('../utils/parseDuration');
const { AttachmentBuilder } = require('discord.js');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // Only handle button interactions
    if (!interaction.isButton()) return;

    // Handle buy product button
    if (interaction.customId.startsWith('buy_product_')) {
      await handleBuyProduct(interaction);
    }
  }
};

async function handleBuyProduct(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const productId = parseInt(interaction.customId.replace('buy_product_', ''));
  const user = interaction.user;
  const guild = interaction.guild;

  try {
    // Fetch product
    const product = await Product.findOne({
      where: {
        id: productId,
        serverId: guild.id,
        isActive: true
      }
    });

    if (!product) {
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Product Not Found',
          'This product is no longer available.'
        )]
      });
    }

    // Check if user already has this role
    const member = await guild.members.fetch(user.id);
    const role = guild.roles.cache.get(product.roleId);

    if (!role) {
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Role Not Found',
          'The role for this product no longer exists.'
        )]
      });
    }

    // Check if user already has temporary role
    const existingTempRole = await TemporaryRole.findOne({
      where: {
        serverId: guild.id,
        userId: user.id,
        roleId: role.id
      }
    });

    if (existingTempRole || member.roles.cache.has(role.id)) {
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Role Already Owned',
          `You already have the ${role} role. Please wait until it expires before purchasing again.`
        )]
      });
    }

    // Check for pending transaction
    const pendingTransaction = await Transaction.findOne({
      where: {
        userId: user.id,
        productId: product.id,
        status: 'pending'
      }
    });

    if (pendingTransaction) {
      const formattedPrice = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
      }).format(product.price);

      // Check if we have QR code data in midtransData
      const hasQrCode = pendingTransaction.midtransData && pendingTransaction.midtransData.qrCodeBuffer;

      const embed = createInfoEmbed(
        'Pending Payment',
        hasQrCode
          ? `You already have a pending payment for **${product.name}**. Scan the QR code below to complete payment.`
          : `You already have a pending payment for **${product.name}**`,
        [
          { name: 'Order ID', value: pendingTransaction.orderId, inline: true },
          { name: 'Amount', value: formattedPrice, inline: true }
        ]
      );

      if (hasQrCode) {
        embed.setImage('attachment://qris.png');
      }

      embed.setFooter({
        text: 'Complete your payment or wait for it to expire',
        iconURL: QTRADES_LOGO_URL || interaction.client.user.displayAvatarURL()
      });

      if (hasQrCode) {
        const qrBuffer = Buffer.from(pendingTransaction.midtransData.qrCodeBuffer);
        const qrAttachment = new AttachmentBuilder(qrBuffer, { name: 'qris.png' });
        return interaction.editReply({ embeds: [embed], files: [qrAttachment] });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    // Generate unique order ID
    const orderId = `ORDER-${Date.now()}-${user.id}`;

    // Create Midtrans transaction
    const midtransResult = await createTransaction({
      orderId: orderId,
      amount: product.price,
      customerDetails: {
        first_name: user.username,
        email: `${user.id}@discord.user`,
        phone: '08123456789'
      },
      itemDetails: [
        {
          id: product.id.toString(),
          price: product.price,
          quantity: 1,
          name: product.name
        }
      ]
    });

    if (!midtransResult.success) {
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Payment Error',
          'Failed to create payment. Please try again later.'
        )]
      });
    }

    // Save transaction to database
    await Transaction.create({
      orderId: orderId,
      userId: user.id,
      serverId: guild.id,
      productId: product.id,
      amount: product.price,
      status: 'pending',
      paymentUrl: midtransResult.qrisString,
      paymentType: 'qris',
      midtransData: midtransResult
    });

    // Format price
    const formattedPrice = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(product.price);

    // Calculate expiry time (format the expiry_time from Midtrans)
    const expiryDate = midtransResult.expiryTime ? new Date(midtransResult.expiryTime) : null;
    const expiryTimestamp = expiryDate ? `<t:${Math.floor(expiryDate.getTime() / 1000)}:R>` : '24 hours';

    // Create embed with QR code
    const embed = createSuccessEmbed(
      'Payment Created',
      `Scan the QR code below to pay for **${product.name}**`,
      [
        { name: 'Product', value: product.name, inline: true },
        { name: 'Role', value: `${role}`, inline: true },
        { name: 'Price', value: formattedPrice, inline: true },
        { name: 'Duration', value: formatDuration(product.duration), inline: true },
        { name: 'Order ID', value: orderId, inline: false },
        { name: 'Expires', value: expiryTimestamp, inline: false }
      ]
    );

    embed.setImage('attachment://qris.png')
      .setFooter({
        text: 'Scan with any e-wallet app • Role will be assigned automatically',
        iconURL: QTRADES_LOGO_URL || interaction.client.user.displayAvatarURL()
      })
      .setThumbnail(QTRADES_LOGO_URL || role.iconURL() || guild.iconURL({ dynamic: true }));

    // Create attachment from QR code buffer
    const qrAttachment = new AttachmentBuilder(midtransResult.qrCodeBuffer, { name: 'qris.png' });

    await interaction.editReply({
      embeds: [embed],
      files: [qrAttachment]
    });

    // Also send DM with QR code
    try {
      const dmQrAttachment = new AttachmentBuilder(midtransResult.qrCodeBuffer, { name: 'qris.png' });
      await user.send({
        embeds: [embed],
        files: [dmQrAttachment]
      });
    } catch (error) {
      console.log(`Could not send DM to ${user.tag}`);
    }

  } catch (error) {
    console.error('Error handling buy product:', error);
    return interaction.editReply({
      embeds: [createErrorEmbed(
        'Error',
        'An error occurred while processing your request. Please try again.'
      )]
    });
  }
}
