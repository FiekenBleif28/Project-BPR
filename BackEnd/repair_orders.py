#!/usr/bin/env python3
"""
Repair historical orders in db.json:
- Compute total from layanan + berat/jumlah if total == 0
- Ensure all VA payment orders have valid vaNumber
- Restore bankName from vaNumber prefix if null for VA payments
"""

import json
import shutil
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent / "db.json"
BACKUP_PATH = Path(__file__).parent / f"db_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

PRICE_MAP = {
    'reguler_lipat': 5000,
    'reguler_setrika': 7000,
    'express_lipat': 9000,
    'express_setrika': 13000,
    'kilat_lipat': 13000,
    'kilat_setrika': 18000,
    'bedcover_reguler_kecil': 30000,
    'bedcover_reguler_besar': 40000,
    'bedcover_express': 55000,
    'sprei_reguler': 12000,
    'sprei_express': 18000,
    'sprei_kilat': 25000,
    'baby_laundry': 20000,
    'baby_stroller': 150000,
}

BANK_PREFIXES = {
    '1234567': 'BCA',
    '7890123': 'Mandiri',
    '4567890': 'BRI',
    '2345678': 'BNI',
}

def guess_bank_from_va(va_number):
    """Try to guess bank from VA number prefix."""
    if not va_number or not isinstance(va_number, str):
        return None
    for prefix, bank in BANK_PREFIXES.items():
        if va_number.startswith(prefix):
            return bank
    # If starts with VA, it was auto-generated; return None
    return None

def repair_order(order):
    """Repair a single order record."""
    changed = False
    
    # 1. Compute total if missing or 0
    if not order.get('total') or order.get('total') == 0:
        layanan = order.get('layanan', '')
        berat = order.get('berat', 0)
        jumlah = order.get('jumlah', 0)
        
        price = PRICE_MAP.get(layanan)
        if price:
            # Use berat if available and > 0, else jumlah
            qty = berat if berat and berat > 0 else (jumlah if jumlah and jumlah > 0 else 1)
            new_total = price * qty
            if new_total > 0:
                order['total'] = float(new_total)
                changed = True
                print(f"  ✓ Computed total: {new_total} for {layanan} x {qty}")
    
    # 2. Generate VA number if missing but payment is 'va'
    if order.get('metodePembayaran') == 'va' and (not order.get('vaNumber') or order.get('vaNumber') is None):
        import uuid
        short = str(uuid.uuid4()).replace('-', '')[:8]
        va_number = f"VA{order.get('tanggal', '').split('T')[0].replace('-', '')}{short}"
        order['vaNumber'] = va_number
        changed = True
        print(f"  ✓ Generated VA number: {va_number}")
    
    # 3. Try to infer bankName from vaNumber if null
    if order.get('metodePembayaran') == 'va' and (not order.get('bankName') or order.get('bankName') is None):
        va_num = order.get('vaNumber')
        bank = guess_bank_from_va(va_num)
        if bank:
            order['bankName'] = bank
            changed = True
            print(f"  ✓ Inferred bankName: {bank} from VA {va_num}")
    
    return changed

def main():
    print("=" * 60)
    print("REPAIR ORDERS SCRIPT")
    print("=" * 60)
    
    if not DB_PATH.exists():
        print(f"❌ db.json not found at {DB_PATH}")
        return
    
    # Load original data
    print(f"\n📂 Loading db.json from {DB_PATH}")
    with open(DB_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Create backup
    print(f"💾 Creating backup: {BACKUP_PATH}")
    shutil.copy(DB_PATH, BACKUP_PATH)
    print(f"   ✓ Backup created successfully")
    
    # Process orders
    orders = data.get('orders', [])
    print(f"\n🔍 Processing {len(orders)} orders...")
    
    changed_count = 0
    for idx, order in enumerate(orders):
        order_id = order.get('id', f'ORDER-{idx}')
        print(f"\n  Order {idx + 1}/{len(orders)}: {order_id}")
        
        if repair_order(order):
            changed_count += 1
    
    # Save repaired data
    print(f"\n💾 Saving repaired data...")
    with open(DB_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Repair complete!")
    print(f"   - Orders processed: {len(orders)}")
    print(f"   - Orders modified: {changed_count}")
    print(f"   - Backup file: {BACKUP_PATH}")
    print("=" * 60)

if __name__ == '__main__':
    main()
