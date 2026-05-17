/**
 * PaymentMethodPicker — placeholder.
 *
 * Task 18 will replace this with the real modal that shows a radio list of
 * available payment methods (with estimated Louvin fees) and triggers
 * `api.shop.checkout(productId, method)` on submit.
 *
 * Contract used by Shop.jsx:
 *   <PaymentMethodPicker
 *     product={product}
 *     onClose={() => setPicker(null)}
 *     onCheckout={async (method) => { ... }}
 *   />
 */
export default function PaymentMethodPicker({ product, onClose, onCheckout }) {
  // Intentionally renders nothing — Task 18 implements the real UI.
  return null;
}
