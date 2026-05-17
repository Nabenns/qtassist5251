import { useState } from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter
} from './ui/Modal.jsx';
import { Button } from './ui/Button.jsx';
import {
  formatIDR,
  paymentMethodLabel,
  estimateLouvinFee
} from '../api.js';

/**
 * PaymentMethodPicker — modal for selecting a payment method before checkout.
 *
 * Props:
 *   product    { id, name, price, paymentMethods: string[] }
 *   onClose    () => void               called when the user cancels / dismisses
 *   onCheckout async (method) => void   called with the selected method
 *
 * Renders the product price, a brutalist radio list of available payment
 * methods (each showing the per-method Louvin fee estimate), and a fee
 * breakdown (subtotal + fee + total). The Pay button is disabled and shows
 * a spinner while `onCheckout` is in flight.
 */
export default function PaymentMethodPicker({ product, onClose, onCheckout }) {
  const methods =
    Array.isArray(product?.paymentMethods) && product.paymentMethods.length > 0
      ? product.paymentMethods
      : ['qris'];
  const [method, setMethod] = useState(methods[0]);
  const [busy, setBusy] = useState(false);

  const fee = estimateLouvinFee(product.price, method);
  const total = product.price + fee;

  async function handlePay() {
    setBusy(true);
    try {
      await onCheckout(method);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={true}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <ModalHeader
        title={`Beli: ${product.name}`}
        description="Pilih metode pembayaran untuk melanjutkan checkout."
        onClose={busy ? undefined : onClose}
      />
      <ModalBody>
        <div className="border border-border bg-surface-2 px-3 py-2 text-sm">
          <div className="text-xs uppercase tracking-wider text-muted-fg">
            Harga produk
          </div>
          <div className="font-mono text-base font-bold text-fg">
            {formatIDR(product.price)}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-fg">
            Pilih metode pembayaran
          </div>
          <div role="radiogroup" aria-label="Metode pembayaran" className="space-y-2">
            {methods.map((m) => {
              const mFee = estimateLouvinFee(product.price, m);
              const selected = method === m;
              return (
                <label
                  key={m}
                  className={
                    'flex cursor-pointer items-center gap-3 border px-3 py-2 transition-colors ' +
                    (selected
                      ? 'border-primary bg-surface-2'
                      : 'border-border hover:bg-surface-2')
                  }
                >
                  <input
                    type="radio"
                    name="payment-method"
                    value={m}
                    checked={selected}
                    onChange={() => setMethod(m)}
                    disabled={busy}
                    className="h-4 w-4 accent-primary"
                  />
                  <div className="flex-1">
                    <div className="font-display text-sm font-bold text-fg">
                      {paymentMethodLabel(m)}
                    </div>
                    <div className="text-xs text-muted-fg">
                      Fee:{' '}
                      <span className="font-mono">{formatIDR(mFee)}</span>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="border border-border bg-surface-2 px-3 py-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-fg">Subtotal</span>
            <span className="font-mono text-fg">
              {formatIDR(product.price)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-muted-fg">
              Biaya layanan ({paymentMethodLabel(method)})
            </span>
            <span className="font-mono text-fg">{formatIDR(fee)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
            <span className="font-display text-xs font-bold uppercase tracking-wider text-fg">
              Total bayar
            </span>
            <span className="font-mono text-base font-bold text-fg">
              {formatIDR(total)}
            </span>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Batal
        </Button>
        <Button onClick={handlePay} loading={busy}>
          Bayar Sekarang
        </Button>
      </ModalFooter>
    </Modal>
  );
}
