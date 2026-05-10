# Multiple Bank Accounts Configuration Guide

## Overview

QTAssist5251 mendukung **multiple bank accounts** untuk payment. User bisa transfer ke salah satu rekening yang tersedia.

---

## Configuration

### Single Account (Default)

Untuk 1 rekening saja:

```env
BANK_NAME=BCA
ACCOUNT_NUMBER=1234567890
ACCOUNT_HOLDER=QTrades Official
```

**Tampilan:**
```
💳 Bank Transfer Details:
Bank: BCA
Account Number: 1234567890
Account Holder: QTrades Official
```

---

### Multiple Accounts (2 atau lebih)

Untuk 2+ rekening, pisahkan dengan `|` (pipe):

```env
BANK_NAMES=BCA|Mandiri
ACCOUNT_NUMBERS=1234567890|9876543210
ACCOUNT_HOLDERS=QTrades Official|QTrades Backup
```

**Tampilan:**
```
💳 Bank Transfer Details:

Option 1:
Bank: BCA
Account Number: 1234567890
Account Holder: QTrades Official

Option 2:
Bank: Mandiri
Account Number: 9876543210
Account Holder: QTrades Backup
```

---

### 3+ Accounts

```env
BANK_NAMES=BCA|Mandiri|BRI|BNI
ACCOUNT_NUMBERS=1234567890|9876543210|5555666777|1111222333
ACCOUNT_HOLDERS=QTrades Official|QTrades Backup|QTrades Support|QTrades Main
```

**Tampilan:**
```
💳 Bank Transfer Details:

Option 1:
Bank: BCA
Account Number: 1234567890
Account Holder: QTrades Official

Option 2:
Bank: Mandiri
Account Number: 9876543210
Account Holder: QTrades Backup

Option 3:
Bank: BRI
Account Number: 5555666777
Account Holder: QTrades Support

Option 4:
Bank: BNI
Account Number: 1111222333
Account Holder: QTrades Main
```

---

## Important Notes

### 1. Delimiter
- Gunakan `|` (pipe character) untuk memisahkan
- **Jangan** pakai koma `,` atau titik koma `;`

### 2. Order Matching
Urutan harus sama:
```env
BANK_NAMES=BCA|Mandiri|BRI
ACCOUNT_NUMBERS=1234567890|9876543210|5555666777
ACCOUNT_HOLDERS=Owner 1|Owner 2|Owner 3
                   ↑         ↑         ↑
                  BCA     Mandiri     BRI
```

### 3. Spaces
Spasi sebelum/sesudah `|` akan di-trim otomatis:
```env
# Ini sama saja:
BANK_NAMES=BCA|Mandiri|BRI
BANK_NAMES=BCA | Mandiri | BRI
BANK_NAMES= BCA | Mandiri | BRI
```

### 4. Priority
Jika ada `BANK_NAMES`, maka `BANK_NAME` (singular) akan diabaikan:
```env
# Bot akan pakai BANK_NAMES (multiple)
BANK_NAMES=BCA|Mandiri
BANK_NAME=BRI  # <- Ini diabaikan
```

---

## Examples

### Example 1: E-commerce dengan 2 bank

```env
BANK_NAMES=BCA|Mandiri
ACCOUNT_NUMBERS=1234567890|0987654321
ACCOUNT_HOLDERS=Toko ABC|Toko ABC Backup
```

### Example 2: Server dengan regional accounts

```env
BANK_NAMES=BCA Jakarta|BCA Surabaya|Mandiri Bali
ACCOUNT_NUMBERS=1111222333|4444555666|7777888999
ACCOUNT_HOLDERS=QTrades HQ|QTrades Regional 1|QTrades Regional 2
```

### Example 3: Different currencies (future)

```env
BANK_NAMES=BCA (IDR)|PayPal (USD)|Wise (EUR)
ACCOUNT_NUMBERS=1234567890|paypal@qtrades.com|wise-123456
ACCOUNT_HOLDERS=QTrades Indonesia|QTrades International|QTrades Europe
```

---

## Troubleshooting

### Issue: Hanya bank pertama yang tampil

**Penyebab:** Pakai `BANK_NAME` (singular) bukan `BANK_NAMES` (plural)

**Solusi:**
```env
# Salah
BANK_NAME=BCA|Mandiri

# Benar
BANK_NAMES=BCA|Mandiri
```

---

### Issue: Jumlah bank tidak match dengan nomor rekening

**Penyebab:** Jumlah item tidak sama

```env
# Salah - 2 bank, 3 nomor
BANK_NAMES=BCA|Mandiri
ACCOUNT_NUMBERS=111|222|333
```

**Solusi:** Pastikan jumlahnya sama
```env
# Benar
BANK_NAMES=BCA|Mandiri
ACCOUNT_NUMBERS=111|222
ACCOUNT_HOLDERS=Owner 1|Owner 2
```

---

### Issue: Karakter `|` muncul di nama bank

**Penyebab:** Typo atau encoding issue

**Solusi:** Pastikan pakai pipe `|` bukan karakter lain
```env
# Benar: | (pipe - Shift + \ di keyboard)
BANK_NAMES=BCA|Mandiri

# Salah: l (huruf L kecil)
BANK_NAMES=BCAlMandiri
```

---

## Testing

### Test Multiple Accounts

1. Set env dengan 2+ accounts
2. Restart bot
3. User klik button product
4. Cek apakah tampil:
   - "Option 1:", "Option 2:", dst
   - Semua bank details
   - Instruksi "transfer to **one of the accounts**"

### Visual Check

Embed harus tampil seperti:
```
💳 Payment Instructions

Product: VIP Role
Price: Rp 50.000
...

💳 Bank Transfer Details:

Option 1:
Bank: BCA
Account Number: 1234567890
Account Holder: QTrades

Option 2:
Bank: Mandiri
Account Number: 9876543210
Account Holder: QTrades Backup

📝 Instructions:
1️⃣ Transfer exact amount (Rp 50.000) to one of the accounts above
...
```

---

## Migration from Single to Multiple

### Before
```env
BANK_NAME=BCA
ACCOUNT_NUMBER=1234567890
ACCOUNT_HOLDER=QTrades Official
```

### After (Add second account)

**Option A: Keep both formats (recommended)**
```env
# Fallback jika BANK_NAMES tidak ada
BANK_NAME=BCA
ACCOUNT_NUMBER=1234567890
ACCOUNT_HOLDER=QTrades Official

# Primary - Multiple accounts
BANK_NAMES=BCA|Mandiri
ACCOUNT_NUMBERS=1234567890|9876543210
ACCOUNT_HOLDERS=QTrades Official|QTrades Backup
```

**Option B: Only multiple**
```env
# Hapus single format
BANK_NAMES=BCA|Mandiri
ACCOUNT_NUMBERS=1234567890|9876543210
ACCOUNT_HOLDERS=QTrades Official|QTrades Backup
```

**No restart needed** - Bot akan otomatis detect perubahan di next transaction.

---

## Best Practices

1. **Gunakan nama bank yang jelas**
   ```env
   # Good
   BANK_NAMES=BCA|Mandiri|BRI

   # Better - dengan cabang
   BANK_NAMES=BCA Jakarta|Mandiri Surabaya|BRI Bali
   ```

2. **Gunakan account holder yang konsisten**
   ```env
   # Good
   ACCOUNT_HOLDERS=QTrades Official|QTrades Official

   # Better - dengan identifier
   ACCOUNT_HOLDERS=QTrades (Main)|QTrades (Backup)
   ```

3. **Dokumentasikan rekening internal**
   Buat file `bank-accounts.txt` untuk reference:
   ```
   Account 1:
   - Bank: BCA
   - Number: 1234567890
   - Holder: QTrades
   - Purpose: Primary payment

   Account 2:
   - Bank: Mandiri
   - Number: 9876543210
   - Holder: QTrades
   - Purpose: Backup/overflow
   ```

---

## FAQ

**Q: Berapa maksimal rekening yang bisa ditambahkan?**
A: Teknis tidak ada limit, tapi Discord embed max 25 fields. Rekomendasikan max 5-6 accounts supaya tidak terlalu panjang.

**Q: Bisa beda bank beda negara?**
A: Bisa, tapi pastikan currency-nya jelas di nama bank:
```env
BANK_NAMES=BCA Indonesia (IDR)|PayPal International (USD)
```

**Q: User bisa pilih rekening mana?**
A: User bisa transfer ke salah satu rekening yang ditampilkan, tidak ada seleksi. Semua rekening equivalen.

**Q: Admin bisa tau user transfer ke rekening mana?**
A: Ya, dari bukti transfer yang di-upload user. Tidak ada tracking otomatis.

**Q: Bisa dynamic per-product?**
A: Saat ini belum support. Semua product menggunakan rekening yang sama dari env. Untuk future improvement bisa tambahkan field `bankAccountIndex` di Product model.

---

**Last Updated:** 2026-05-10
