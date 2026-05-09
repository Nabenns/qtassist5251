const midtransClient = require('midtrans-client');
const QRCode = require('qrcode');

// Initialize Core API client (for QRIS)
const core = new midtransClient.CoreApi({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY
});

// Initialize Snap client (for fallback)
const snap = new midtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY
});

/**
 * Create payment transaction with QRIS - using Core API for direct QRIS
 * @param {Object} params - Transaction parameters
 * @param {string} params.orderId - Unique order ID
 * @param {number} params.amount - Amount in IDR
 * @param {Object} params.customerDetails - Customer info
 * @param {Array} params.itemDetails - Items being purchased
 * @returns {Promise<Object>} Transaction response with QR code and payment link
 */
async function createTransaction({ orderId, amount, customerDetails, itemDetails }) {
  try {
    // Create QRIS transaction using Core API for direct QR code
    const chargeParameter = {
      payment_type: 'qris',
      transaction_details: {
        order_id: orderId,
        gross_amount: amount
      },
      customer_details: customerDetails,
      item_details: itemDetails
    };

    const qrisTransaction = await core.charge(chargeParameter);

    // Generate QR Code from QRIS string
    let qrCodeBuffer = null;
    let qrisString = null;

    if (qrisTransaction.actions && qrisTransaction.actions.length > 0) {
      // Get QRIS string from actions
      const qrisAction = qrisTransaction.actions.find(action => action.name === 'generate-qr-code');
      if (qrisAction && qrisAction.url) {
        qrisString = qrisAction.url;

        // Generate QR code image from QRIS string
        qrCodeBuffer = await QRCode.toBuffer(qrisString, {
          width: 400,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
      }
    }

    // Also create Snap transaction for payment link (as backup option)
    const snapParameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amount
      },
      customer_details: customerDetails,
      item_details: itemDetails
    };

    const snapTransaction = await snap.createTransaction(snapParameter);

    return {
      success: true,
      orderId: orderId,
      qrisString: qrisString,
      qrCodeBuffer: qrCodeBuffer,
      paymentLink: snapTransaction.redirect_url,
      token: snapTransaction.token,
      rawData: {
        qris: qrisTransaction,
        snap: snapTransaction
      }
    };

  } catch (error) {
    console.error('Midtrans createTransaction error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get transaction status
 * @param {string} orderId - Order ID to check
 * @returns {Promise<Object>} Transaction status
 */
async function getTransactionStatus(orderId) {
  try {
    const statusResponse = await snap.transaction.status(orderId);

    return {
      success: true,
      orderId: statusResponse.order_id,
      transactionStatus: statusResponse.transaction_status,
      fraudStatus: statusResponse.fraud_status,
      paymentType: statusResponse.payment_type,
      grossAmount: statusResponse.gross_amount,
      transactionTime: statusResponse.transaction_time,
      rawData: statusResponse
    };

  } catch (error) {
    console.error('Midtrans getTransactionStatus error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Verify notification from Midtrans webhook
 * @param {Object} notification - Notification data from Midtrans
 * @returns {Object} Verified notification data
 */
function verifyNotification(notification) {
  try {
    const statusResponse = snap.transaction.notification(notification);

    const orderId = statusResponse.order_id;
    const transactionStatus = statusResponse.transaction_status;
    const fraudStatus = statusResponse.fraud_status;
    const paymentType = statusResponse.payment_type;

    let isPaid = false;

    // Determine if payment is successful
    if (transactionStatus === 'capture') {
      if (fraudStatus === 'accept') {
        isPaid = true;
      }
    } else if (transactionStatus === 'settlement') {
      isPaid = true;
    } else if (transactionStatus === 'pending') {
      isPaid = false;
    } else if (transactionStatus === 'deny' || transactionStatus === 'expire' || transactionStatus === 'cancel') {
      isPaid = false;
    }

    return {
      orderId,
      transactionStatus,
      fraudStatus,
      paymentType,
      isPaid,
      rawData: statusResponse
    };

  } catch (error) {
    console.error('Midtrans verifyNotification error:', error);
    return {
      error: error.message
    };
  }
}

module.exports = {
  createTransaction,
  getTransactionStatus,
  verifyNotification
};
