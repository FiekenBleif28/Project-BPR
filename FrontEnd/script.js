// Clean, tracking-free frontend script

var API_BASE_URL = (window && window.API_BASE_URL) ? window.API_BASE_URL : 'http://127.0.0.1:8080';

function $(sel) {
  return document.querySelector(sel);
}

function $$(sel) {
  return Array.prototype.slice.call(document.querySelectorAll(sel));
}

// Mobile menu
var mobileToggle = $('.mobile-menu-toggle');
var navMenu = $('.nav-menu');
if (mobileToggle && navMenu) {
  mobileToggle.addEventListener('click', function () {
    navMenu.classList.toggle('active');
  });
}

// Smooth scroll
$$('a[href^="#"]').forEach(function (a) {
  a.addEventListener('click', function (e) {
    var href = this.getAttribute('href');
    if (!href || href === '#') return;
    e.preventDefault();
    var target = document.querySelector(href);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// Fade-in
try {
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  $$('.fade-in').forEach(function (el) {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
    io.observe(el);
  });
} catch (e) {
  /* ignore */
}

// Chat
var chatForm = $('#chatForm');
var chatBox = $('#chatBox');
var userInput = $('#userInput');

function addMessage(text, sender) {
  if (!chatBox) return null;
  var messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message ' + sender + '-message';
  var avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = (sender === 'user') ? '👤' : '🤖';
  var content = document.createElement('div');
  content.className = 'message-content';
  var p = document.createElement('p');
  p.textContent = text;
  content.appendChild(p);
  messageDiv.appendChild(avatar);
  messageDiv.appendChild(content);
  chatBox.appendChild(messageDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
  return messageDiv;
}

if (chatForm && chatBox && userInput) {
  chatForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var message = userInput.value.trim();
    if (!message) return;
    addMessage(message, 'user');
    userInput.value = '';
    var loading = addMessage('Memproses...', 'bot');
    loading.classList.add('loading');
    var submitBtn = chatForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 15000);

    (async function () {
      try {
        var res = await fetch(API_BASE_URL + '/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: message }),
          signal: controller.signal
        });

        if (!res.ok) throw new Error('HTTP ' + res.status);
        var data = await res.json();
        if (loading && loading.parentNode === chatBox) chatBox.removeChild(loading);
        addMessage(data.reply || 'Maaf, saya tidak bisa menjawab pertanyaan itu.', 'bot');
      } catch (err) {
        console.error('Chat error', err);
        try { if (loading && loading.parentNode === chatBox) chatBox.removeChild(loading); } catch (e) { }
        addMessage('Terjadi kesalahan. Silakan coba lagi.', 'bot');
      } finally {
        clearTimeout(timeout);
        if (submitBtn) submitBtn.disabled = false;
      }
    })();
  });

  userInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatForm.dispatchEvent(new Event('submit'));
    }
  });
}

// Order & payment
var orderForm = $('#orderForm');
var priceMap = {
  'reguler_lipat': 5000,
  'reguler_setrika': 7000,
  'express_lipat': 9000,
  'express_setrika': 13000,
  'kilat_lipat': 13000,
  'kilat_setrika': 18000
};

function calculateTotal(layanan, berat) {
  if (!layanan) return 0;
  
  // Try LAYANAN_DATA first (complete data with kg/pcs)
  if (LAYANAN_DATA && LAYANAN_DATA[layanan]) {
    var info = LAYANAN_DATA[layanan];
    var qty = (berat ? parseFloat(berat) : 1);
    return info.harga * qty;
  }
  
  // Fallback ke priceMap (legacy)
  if (priceMap[layanan]) {
    var base = priceMap[layanan];
    return base * (berat ? parseFloat(berat) : 1);
  }
  
  return 0;
}

function formatCurrency(amount) {
  try {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  } catch (e) {
    return 'Rp ' + (amount || 0);
  }
}

if (orderForm) {
  orderForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var namaEl = $('#nama');
    var layananEl = $('#layanan');
    var beratEl = $('#berat');
    var alamatEl = $('#alamat');
    if (!namaEl || !layananEl || !alamatEl) { alert('Form tidak lengkap. Silakan refresh halaman.'); return; }

    var nama = namaEl.value.trim();
    var layanan = layananEl.value;
    var berat = (beratEl && beratEl.value) ? beratEl.value : '';
    var alamat = alamatEl.value.trim();
    var catatan = ($('#catatan') && $('#catatan').value) ? $('#catatan').value.trim() : '';

    if (!nama || !layanan || !alamat) { alert('Mohon isi semua field termasuk alamat!'); return; }
    var isPerKg = (layanan.indexOf('reguler_') !== -1) || (layanan.indexOf('express_') !== -1) || (layanan.indexOf('kilat_') !== -1);
    var jumlah = isPerKg ? (berat ? parseFloat(berat) : 1) : 1;

    window.currentOrder = {
      userId: null,
      nama: nama,
      layanan: layanan,
      jumlah: jumlah,
      berat: (berat ? parseFloat(berat) : null),
      alamat: alamat,
      catatan: catatan,
      metode_pembayaran: '',
      status_pembayaran: '',
      total: calculateTotal(layanan, berat)
    };

    showPaymentModal(window.currentOrder.total);
  });
}

// Bank / VA
var bankList = [
  { name: 'BCA', code: 'bca', prefix: '1234567' },
  { name: 'Mandiri', code: 'mandiri', prefix: '7890123' },
  { name: 'BRI', code: 'bri', prefix: '4567890' },
  { name: 'BNI', code: 'bni', prefix: '2345678' }
];

function populateBankList() {
  var container = $('#bankList');
  if (!container) return;
  var html = '';
  for (var i = 0; i < bankList.length; i++) {
    var b = bankList[i];
    html += '<div class="bank-option" data-bank="' + b.code + '"><div class="bank-name">' + b.name + '</div><div class="bank-select">→</div></div>';
  }
  container.innerHTML = html;
  var opts = document.querySelectorAll('.bank-option');
  for (var j = 0; j < opts.length; j++) {
    (function (o) { o.addEventListener('click', function () { selectBank(o.getAttribute('data-bank')); }); })(opts[j]);
  }
}

function selectBank(code) {
  if (!window.currentOrder) { alert('Terjadi kesalahan. Silakan buat pesanan terlebih dahulu.'); return; }
  var bank = null;
  for (var i = 0; i < bankList.length; i++) {
    if (bankList[i].code === code) { bank = bankList[i]; break; }
  }
  if (!bank) return;
  var opts = document.querySelectorAll('.bank-option');
  for (var k = 0; k < opts.length; k++) opts[k].classList.remove('selected');
  var el = document.querySelector('[data-bank="' + code + '"]');
  if (el) el.classList.add('selected');
  var rnd = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  var va = bank.prefix + rnd;
  window.currentOrder.vaNumber = va;
  window.currentOrder.bankName = bank.name;
  var vaDetails = $('#vaDetails');
  var vaNumEl = $('#vaNumber');
  var vaAmtEl = $('#vaAmount');
  if (vaDetails && vaNumEl) {
    vaNumEl.textContent = va;
    if (vaAmtEl) vaAmtEl.textContent = formatCurrency(window.currentOrder.total);
    vaDetails.style.display = 'block';
  }
}

// Payment methods
var paymentMethodsSetup = false;

function setupPaymentMethods() {
  if (paymentMethodsSetup) return;
  var cards = document.querySelectorAll('.payment-method-card');
  if (!cards || cards.length === 0) return;
  for (var i = 0; i < cards.length; i++) {
    (function (c) { c.addEventListener('click', function () { selectPaymentMethod(c.getAttribute('data-method')); }); })(cards[i]);
  }
  paymentMethodsSetup = true;
}

function selectPaymentMethod(method) {
  if (!method) return;
  var cards = document.querySelectorAll('.payment-method-card');
  for (var i = 0; i < cards.length; i++) cards[i].classList.remove('active');
  var card = document.querySelector('[data-method="' + method + '"]');
  if (card) card.classList.add('active');
  var contents = document.querySelectorAll('.payment-content');
  for (var j = 0; j < contents.length; j++) contents[j].style.display = 'none';
  var map = { qris: 'qrisContent', va: 'vaContent' };
  var id = map[method];
  if (id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'block';
    if (method === 'qris') {
      // Ensure we display the full total (no cap). Compute total reliably.
      var displayTotal = (window.currentOrder && window.currentOrder.total !== undefined && !isNaN(window.currentOrder.total)) ? parseFloat(window.currentOrder.total) : calculateTotal(window.currentOrder.layanan, window.currentOrder.berat);
      var q = $('#qrisAmount'); if (q) q.textContent = formatCurrency(displayTotal);
    }
    if (method === 'va') {
      var bankListEl = $('#bankList');
      if (bankListEl && bankListEl.children.length === 0) populateBankList();
    }
  }
}

async function processPayment(method) {
  try {
    if (!window.currentOrder) { alert('Tidak ada pesanan. Silakan buat pesanan terlebih dahulu.'); return; }
    if (method === 'va' && !window.currentOrder.vaNumber) { alert('Silakan pilih bank terlebih dahulu.'); return; }
    var paymentStatus = (method === 'cash') ? 'Belum Dibayar (Cash)' : (method === 'qris') ? 'Berhasil' : 'Menunggu Verifikasi';
    // compute total robustly to avoid sending 0 when value missing
    var computedTotal = (window.currentOrder && window.currentOrder.total !== undefined && !isNaN(window.currentOrder.total)) ? parseFloat(window.currentOrder.total) : calculateTotal(window.currentOrder.layanan, window.currentOrder.berat);
    var payload = {
      userId: window.currentOrder.userId || null,
      nama: String(window.currentOrder.nama || ''),
      layanan: String(window.currentOrder.layanan || ''),
      jumlah: parseFloat(window.currentOrder.jumlah) || 1,
      berat: window.currentOrder.berat || null,
      alamat: String(window.currentOrder.alamat || ''),
      catatan: String(window.currentOrder.catatan || ''),
      metodePembayaran: String(method || ''),
      statusPembayaran: paymentStatus,
      total: parseFloat(computedTotal) || 0
    };
    if (method === 'va') { payload.vaNumber = window.currentOrder.vaNumber || null; payload.bankName = window.currentOrder.bankName || null; }
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 15000);
    var res = null;
    try {
      res = await fetch(API_BASE_URL + '/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
    } catch (err) {
      console.error('Network error', err);
      if (err.name === 'AbortError') alert('Permintaan ke server memakan waktu terlalu lama.'); else alert('Gagal menghubungi server. Pastikan backend berjalan pada ' + API_BASE_URL);
      clearTimeout(timeout);
      return;
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) {
      var errText = 'HTTP ' + res.status;
      try {
        var ct = res.headers.get('content-type') || '';
        if (ct.indexOf('application/json') !== -1) {
          var j = await res.json();
          errText = j.detail || j.message || JSON.stringify(j);
        } else {
          errText = await res.text();
        }
      } catch (e) { }
      alert('Gagal membuat pesanan: ' + errText);
      return;
    }
    var result = null;
    try { result = await res.json(); } catch (e) { alert('Server merespons dengan format tidak dikenal.'); return; }
    if (!result || !result.success) { alert((result && result.message) ? result.message : 'Gagal membuat pesanan.'); return; }

    closePaymentModal();
    showSuccessModal((result.order && result.order.id) ? result.order.id : '');
    var of = document.getElementById('orderForm'); if (of) try { of.reset(); } catch (e) { }
    window.currentOrder = null;
    if (typeof loadUserDashboard === 'function') loadUserDashboard();
    if (typeof loadAdminDashboard === 'function') loadAdminDashboard();
  } catch (error) {
    console.error('Error processing payment', error);
    alert('Terjadi kesalahan saat memproses pembayaran.');
  }
}

// Payment modal handlers
function showPaymentModal(total) {
  var modal = document.getElementById('paymentModal');
  var totalEl = document.getElementById('paymentTotal');
  if (totalEl) totalEl.textContent = formatCurrency(total);
  if (modal) modal.classList.add('active');
  setupPaymentMethods();
  // Tampilkan nominal di QRIS dan VA langsung
  var qrisAmountEl = document.getElementById('qrisAmount');
  if (qrisAmountEl) qrisAmountEl.textContent = formatCurrency(total);
  var vaAmountEl = document.getElementById('vaAmount');
  if (vaAmountEl) vaAmountEl.textContent = formatCurrency(total);
  // Pilih QRIS sebagai default
  selectPaymentMethod('qris');
}

function closePaymentModal() {
  var m = document.getElementById('paymentModal');
  if (m) m.classList.remove('active');
}

function showSuccessModal(orderId) {
  var modal = document.getElementById('successModal');
  if (!modal) return;
  var idEl = modal.querySelector('#successOrderId');
  if (idEl) idEl.innerHTML = 'Nomor Pesanan: <strong>' + orderId + '</strong>';
  modal.classList.add('active');
}

function closeSuccessModal() {
  var m = document.getElementById('successModal');
  if (m) m.classList.remove('active');
  // Reload page after closing success modal
  setTimeout(function() {
    window.location.reload();
  }, 300);
}

var closePay = document.getElementById('closePaymentModal'); if (closePay) closePay.addEventListener('click', closePaymentModal);
var closeSuc = document.getElementById('closeSuccessModal'); if (closeSuc) closeSuc.addEventListener('click', closeSuccessModal);

// Complaint modal handlers
var complaintBtn = document.getElementById('complaintBtn');
var complaintModal = document.getElementById('complaintModal');
var closeComplaintBtn = document.getElementById('closeComplaintModal');
if (complaintBtn && complaintModal) {
  complaintBtn.addEventListener('click', function () {
    // Parse order id from success modal text or from currentOrder
    var orderText = (document.getElementById('successOrderId') && document.getElementById('successOrderId').innerText) ? document.getElementById('successOrderId').innerText : '';
    var match = orderText.match(/([A-Z]{3}-\d{14}-[0-9A-F]{4})/);
    var orderId = (match && match[1]) ? match[1] : ((window.currentOrder && window.currentOrder.id) ? window.currentOrder.id : '');
    var orderIdEl = document.getElementById('complaintOrderId');
    if (orderIdEl) orderIdEl.value = orderId;
    complaintModal.style.display = 'block';
  });
}
if (closeComplaintBtn && complaintModal) closeComplaintBtn.addEventListener('click', function () { complaintModal.style.display = 'none'; });

// Handle complaint form submission with multipart form-data
var complaintForm = document.getElementById('complaintForm');
if (complaintForm) {
  complaintForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var orderId = (document.getElementById('complaintOrderId') && document.getElementById('complaintOrderId').value) ? document.getElementById('complaintOrderId').value : '';
    var kategori = (document.getElementById('complaintCategory') && document.getElementById('complaintCategory').value) ? document.getElementById('complaintCategory').value : '';
    var deskripsi = (document.getElementById('complaintDescription') && document.getElementById('complaintDescription').value) ? document.getElementById('complaintDescription').value.trim() : '';
    var rating = (document.getElementById('complaintRating') && document.getElementById('complaintRating').value) ? parseInt(document.getElementById('complaintRating').value) : null;
    var photoInput = document.getElementById('complaintPhoto');

    // Validate required fields
    if (!orderId || !kategori || !deskripsi) {
      alert('Silakan isi semua field yang diperlukan.');
      return;
    }

    // Create FormData for multipart upload
    var formData = new FormData();
    formData.append('orderId', orderId);
    formData.append('kategori', kategori);
    formData.append('deskripsi', deskripsi);
    if (rating) formData.append('rating', rating);
    if (photoInput && photoInput.files && photoInput.files[0]) {
      formData.append('foto', photoInput.files[0]);
    }

    try {
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 15000);
      var res = await fetch(API_BASE_URL + '/complaints/create', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!res.ok) {
        var errText = await res.text();
        alert('Gagal mengirim keluhan: ' + errText);
        return;
      }
      var json = await res.json();
      
      // Display success modal with ticket ID
      var ticketId = json.ticketId || (json.complaint && json.complaint.ticketId) || 'N/A';
      var ticketIdElement = document.getElementById('complaintSuccessTicketId');
      if (ticketIdElement) {
        ticketIdElement.textContent = ticketId;
      }
      
      // Hide complaint form modal and show success modal
      var complaintModal = document.getElementById('complaintModal');
      var complaintSuccessModal = document.getElementById('complaintSuccessModal');
      if (complaintModal) complaintModal.style.display = 'none';
      if (complaintSuccessModal) complaintSuccessModal.style.display = 'flex';
      
      // Reset form
      try { complaintForm.reset(); } catch (ex) {}
    } catch (err) {
      console.error('Complaint error', err);
      alert('Gagal mengirim keluhan. Coba lagi.');
    }
  });
}

// Close complaint success modal
var closeComplaintSuccessBtn = document.getElementById('closeComplaintSuccessModal');
if (closeComplaintSuccessBtn) {
  closeComplaintSuccessBtn.addEventListener('click', function () {
    var complaintSuccessModal = document.getElementById('complaintSuccessModal');
    var successModal = document.getElementById('successModal');
    if (complaintSuccessModal) complaintSuccessModal.style.display = 'none';
    if (successModal) successModal.style.display = 'none';

    // 🔥 AUTO RELOAD
    setTimeout(() => {
      window.location.reload();
    }, 300); // delay biar animasi tertutup dulu
  });
}


// Feedback
var submitFeedbackBtn = document.getElementById('submitFeedbackBtn');
if (submitFeedbackBtn) {
  submitFeedbackBtn.addEventListener('click', function () {
    var orderId = (document.getElementById('feedbackOrderId') && document.getElementById('feedbackOrderId').value) ? document.getElementById('feedbackOrderId').value : '';
    var feedback = (document.getElementById('feedbackText') && document.getElementById('feedbackText').value) ? document.getElementById('feedbackText').value.trim() : '';
    if (!feedback) { alert('Tulis feedback dulu.'); return; }
    (async function () {
      try {
        var r = await fetch(API_BASE_URL + '/order/' + orderId + '/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ feedback: feedback }) });
        if (!r.ok) throw new Error('Gagal mengirim feedback');
        alert('Terima kasih atas feedback Anda!'); var ft = document.getElementById('feedbackText'); if (ft) ft.value = '';
      } catch (e) { console.error(e); alert('Gagal mengirim feedback.'); }
    })();
  });
}

// ===== LAYANAN & HARGA DATA =====
var LAYANAN_DATA = {
  'reguler_lipat': { nama: 'Lipat (Reguler 3 Hari)', harga: 5000, unit: 'kg' },
  'reguler_setrika': { nama: 'Setrika (Reguler 3 Hari)', harga: 7000, unit: 'kg' },
  'express_lipat': { nama: 'Lipat (Express 1 Hari)', harga: 9000, unit: 'kg' },
  'express_setrika': { nama: 'Setrika (Express 1 Hari)', harga: 13000, unit: 'kg' },
  'kilat_lipat': { nama: 'Lipat (Kilat 6 Jam)', harga: 13000, unit: 'kg' },
  'kilat_setrika': { nama: 'Setrika (Kilat 6 Jam)', harga: 18000, unit: 'kg' },
  'bedcover_reguler_kecil': { nama: 'Bed Cover Kecil-Sedang (Reguler)', harga: 30000, unit: 'pcs' },
  'bedcover_reguler_besar': { nama: 'Bed Cover Besar (Reguler)', harga: 40000, unit: 'pcs' },
  'bedcover_express': { nama: 'Bed Cover (Express)', harga: 55000, unit: 'pcs' },
  'sprei_reguler': { nama: 'Sprei (Reguler)', harga: 12000, unit: 'pcs' },
  'sprei_express': { nama: 'Sprei (Express)', harga: 18000, unit: 'pcs' },
  'sprei_kilat': { nama: 'Sprei (Kilat)', harga: 25000, unit: 'pcs' },
  'baby_laundry': { nama: 'Baby Laundry (Minimal 3kg)', harga: 20000, unit: 'kg' },
  'baby_stroller': { nama: 'Cuci Baby Stroller (4-5 Hari)', harga: 150000, unit: 'pcs' }
};

// ===== GLOBAL STATE UNTUK ORDER =====
var currentOrder = {
  items: [], // Array of { layanan, harga, jumlah, total }
  totalAmount: 0,
  paymentMethod: null,
  customerName: '',
  customerPhone: '',
  customerAddress: '',
  notes: ''
};

// ===== HELPER FUNCTIONS =====
function delay(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function formatRupiah(num) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(num);
}

function $(selector) {
  return document.querySelector(selector);
}

function $$(selector) {
  return document.querySelectorAll(selector);
}

// ===== HITUNG TOTAL PEMBAYARAN =====
function calculateAndDisplayTotal() {
  var layananSelect = $('#layanan');
  var beratInput = $('#berat');
  var totalDisplay = $('#totalHarga');
  
  if (!layananSelect || !beratInput || !totalDisplay) {
    console.warn('Form elements not found');
    return 0;
  }
  
  var layananValue = layananSelect.value;
  var berat = parseFloat(beratInput.value) || 0;
  
  if (!layananValue || berat <= 0) {
    totalDisplay.textContent = 'Rp0';
    currentOrder.totalAmount = 0;
    return 0;
  }
  
  var layananInfo = LAYANAN_DATA[layananValue];
  if (!layananInfo) {
    totalDisplay.textContent = 'Rp0';
    currentOrder.totalAmount = 0;
    return 0;
  }
  
  // layananInfo.unit can be 'kg' or 'pcs'. The input #berat is reused as numeric value for either kg or pcs.
  var total = layananInfo.harga * berat;
  totalDisplay.textContent = formatRupiah(total);
  currentOrder.totalAmount = total;
  
  return total;
}

// Update unit label and adjust input constraints when layanan changes
function updateUnitLabelAndConvert() {
  var layananSelect = $('#layanan');
  var beratInput = $('#berat');
  var unitLabel = $('#unitLabel');
  if (!layananSelect || !beratInput || !unitLabel) return;

  var layananValue = layananSelect.value;
  var layananInfo = LAYANAN_DATA[layananValue];
  var newUnit = (layananInfo && layananInfo.unit) ? layananInfo.unit : 'kg';

  // preserve previous unit to decide conversion
  var prevUnit = beratInput.getAttribute('data-unit') || 'kg';

  // convert value if switching from kg -> pcs (round) or pcs -> kg (keep numeric)
  var currentVal = parseFloat(beratInput.value) || 0;
  var newVal = currentVal;
  if (prevUnit !== newUnit) {
    if (prevUnit === 'kg' && newUnit === 'pcs') {
      // when switching to pcs, round to nearest integer (at least 1)
      newVal = Math.max(1, Math.round(currentVal) || 1);
    } else if (prevUnit === 'pcs' && newUnit === 'kg') {
      // when switching to kg, keep numeric value (allow decimals)
      newVal = currentVal || 1;
    }
  }

  // update input constraints
  if (newUnit === 'pcs') {
    beratInput.step = '1';
    beratInput.min = '1';
  } else {
    beratInput.step = '0.1';
    beratInput.min = '0.1';
  }

  // apply changes
  beratInput.value = String(newVal);
  beratInput.setAttribute('data-unit', newUnit);
  unitLabel.textContent = newUnit;

  // refresh total display
  calculateAndDisplayTotal();
}

// ===== TRACKING ANIMATION =====
async function startLocalTracking(stepDurationSeconds) {
  var orderStatusEl = $('#orderStatus');
  var progressBar = $('#progressBar');
  var countdownEl = $('#countdown');
  var trackingContainer = $('#trackingAnimationContainer');
  
  if (!orderStatusEl || !progressBar || !countdownEl || !trackingContainer) return;

  var steps = ['Pencucian', 'Pengeringan', 'Setrika'];
  var totalSteps = steps.length;

  for (var i = 0; i < steps.length; i++) {
    orderStatusEl.textContent = 'Status: ' + steps[i] + '...';

    for (var t = stepDurationSeconds; t >= 0; t--) {
      countdownEl.textContent = 'Waktu tersisa: ' + t + 's';
      var progress = ((i + (stepDurationSeconds - t) / stepDurationSeconds) / totalSteps) * 100;
      progressBar.style.width = String(progress) + '%';
      await delay(1000);
    }
  }

  orderStatusEl.textContent = 'Status: Pesanan selesai ✅';
  countdownEl.textContent = '';
  progressBar.style.width = '100%';
}

// ===== SUBMIT ORDER KE BACKEND =====
async function submitOrderToBackend() {
  try {
    var layananVal = ($('#layanan') && $('#layanan').value) ? $('#layanan').value : '';
    var beratVal = ($('#berat') && $('#berat').value) ? parseFloat($('#berat').value) : 0;
    var jumlahVal = (currentOrder && (currentOrder.jumlah || currentOrder.totalAmount)) ? parseFloat(currentOrder.jumlah || currentOrder.jumlah === 0 ? currentOrder.jumlah : jumlahVal) : (beratVal || 1);

    // Normalize currentOrder fields with fallbacks (some listeners use different keys)
    var co = window.currentOrder || currentOrder || {};
    var name = co.customerName || co.nama || co.userName || '';
    var phone = co.customerPhone || co.phone || '';
    var address = co.customerAddress || co.alamat || '';
    var notes = co.notes || co.catatan || '';
    var paymentMethod = co.paymentMethod || co.metode_pembayaran || co.metodePembayaran || '';
    var paymentStatus = (paymentMethod === 'cash') ? 'Belum Dibayar (Cash)' : (paymentMethod === 'qris' ? 'Berhasil' : 'Menunggu Verifikasi');
    var totalVal = (co.totalAmount !== undefined && co.totalAmount !== null) ? co.totalAmount : (co.total !== undefined ? co.total : 0);

    var payload = {

      nama: String(name || ''),
      phone: String(phone || ''),
      alamat: String(address || ''),
      layanan: String(layananVal || co.layanan || ''),
      jumlah: parseFloat(jumlahVal) || (parseFloat(co.jumlah) || 1),
      berat: parseFloat(beratVal) || (parseFloat(co.berat) || 0),
      catatan: String(notes || ''),
      metodePembayaran: String(paymentMethod || ''),
      statusPembayaran: String(paymentStatus || ''),
      total: parseFloat(totalVal) || 0
    };

    // include VA details if present
    if (currentOrder && currentOrder.paymentMethod === 'va') {
      payload.vaNumber = currentOrder.vaNumber || null;
      payload.bankName = currentOrder.bankName || null;
    }

    var response = await fetch(API_BASE_URL + '/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      var result = await response.json();
      console.log('Order submitted successfully:', result);
      // Show success modal with order ID
      var orderId = (result.order && result.order.id) ? result.order.id : 'N/A';
      showSuccessModal(orderId);
      // Reset form
      var orderForm = $('#orderForm');
      if (orderForm) orderForm.reset();
      window.currentOrder = null;
      // Refresh dashboard if function exists
      if (typeof loadUserDashboard === 'function') loadUserDashboard();
      return true;
    } else {
      // Try to parse server error for clearer diagnostics
      var errorText = 'HTTP ' + response.status;
      try {
        var ct = response.headers.get('content-type') || '';
        if (ct.indexOf('application/json') !== -1) {
          var ej = await response.json();
          errorText = ej.detail || ej.message || JSON.stringify(ej);
        } else {
          errorText = await response.text();
        }
      } catch (pe) { console.warn('Error parsing error body', pe); }
      console.error('Failed to submit order:', response.status, errorText);
      alert('Gagal membuat pesanan: ' + errorText + '\n(Periksa console Network/Response untuk detail)');
      return false;
    }
  } catch (error) {
    console.error('Error submitting order:', error);
    alert('Terjadi kesalahan saat mengirim pesanan: ' + (error && error.message ? error.message : String(error)));
    return false;
  }
}

// ===== SETUP FORM LISTENERS =====
function setupFormListeners() {
  var layananSelect = $('#layanan');
  var jumlahInput = $('#jumlah');
  
  if (layananSelect) {
    layananSelect.addEventListener('change', function () { updateUnitLabelAndConvert(); });
  }
  
  var beratInput = $('#berat');
  if (beratInput) {
    beratInput.addEventListener('input', calculateAndDisplayTotal);
  }
}

// ===== SETUP ORDER FORM SUBMISSION =====
function setupOrderForm() {
  var orderForm = $('#orderForm');
  if (!orderForm) return;
  
  orderForm.addEventListener('submit', function (e) {
    e.preventDefault();
    
    // Collect form data
    currentOrder.customerName = $('#nama').value;
    currentOrder.customerPhone = $('#phone').value || '';
    currentOrder.customerAddress = ($('#alamat') && $('#alamat').value) ? $('#alamat').value.trim() : '';
    currentOrder.notes = $('#catatan').value || '';
    
    // Validate
    if (!currentOrder.customerName || !currentOrder.customerAddress) {
      alert('Mohon isi nama dan alamat penjemputan.');
      return;
    }

    // Recalculate total from current form state (supports both kg and pcs units)
    var layananSelect = $('#layanan');
    var beratInput = $('#berat');
    var layananVal = (layananSelect && layananSelect.value) ? layananSelect.value : '';
    var beratVal = (beratInput && beratInput.value) ? parseFloat(beratInput.value) : 0;
    
    if (!layananVal || beratVal <= 0) {
      alert('Mohon pilih layanan dan masukkan jumlah yang valid.');
      return;
    }
    
    var layananInfo = LAYANAN_DATA[layananVal];
    if (!layananInfo) {
      alert('Layanan tidak valid.');
      return;
    }
    
    var computedTotal = layananInfo.harga * beratVal;
    if (computedTotal <= 0 || isNaN(computedTotal)) {
      alert('Total tidak valid. Mohon periksa layanan dan jumlah.');
      return;
    }
    
    currentOrder.totalAmount = computedTotal;
    currentOrder.layanan = layananVal;
    currentOrder.jumlah = beratVal;
    
    // Show payment modal
    var paymentModal = $('#paymentModal');
    if (paymentModal) {
      paymentModal.style.display = 'flex';
      // Update total display in modal
      var modalTotal = $('#paymentTotal');
      if (modalTotal) {
        modalTotal.textContent = formatRupiah(currentOrder.totalAmount);
      }
    }
  });
}

// ===== WIRE PAYMENT CONFIRMATION BUTTONS =====
function setupConfirmPaymentButtons() {
  var confirmBtns = $$('.btn-confirm-payment');
  
  for (var i = 0; i < confirmBtns.length; i++) {
    (function (btn) {
      btn.addEventListener('click', async function (e) {
        e.preventDefault();
        
        var method = btn.getAttribute('data-method');
        if (!method) return;
        
        currentOrder.paymentMethod = method;
        
        // Hide all payment content
        var paymentContents = $$('.payment-content');
        for (var j = 0; j < paymentContents.length; j++) {
          paymentContents[j].style.display = 'none';
        }
        
        // Show tracking animation
        var trackingContainer = $('#trackingAnimationContainer');
        if (trackingContainer) {
          trackingContainer.style.display = 'block';
          // Reset progress bar
          $('#progressBar').style.width = '0%';
          $('#orderStatus').textContent = 'Status: Menunggu...';
          $('#countdown').textContent = 'Waktu tersisa: -';
          
          // Start tracking animation
          await startLocalTracking(5);
          
          // After animation, submit order to backend
          var success = await submitOrderToBackend();
          
          if (success) {
            // Success modal is now displayed with menu buttons by submitOrderToBackend()
            // Hide tracking container
            trackingContainer.style.display = 'none';
            // Hide payment modal
            var paymentModal = $('#paymentModal');
            if (paymentModal) paymentModal.style.display = 'none';
          } else {
            alert('Gagal menyimpan pesanan. Silakan coba lagi.');
            // Hide tracking, show payment content again
            trackingContainer.style.display = 'none';
            var contents = $$('.payment-content');
            for (var k = 0; k < contents.length; k++) {
              contents[k].style.display = 'block';
            }
          }
        }
      });
    })(confirmBtns[i]);
  }
}

// ===== CLOSE PAYMENT MODAL =====
function setupClosePaymentModal() {
  var closeBtn = $('#closePaymentModal');
  var paymentModal = $('#paymentModal');
  
  if (closeBtn && paymentModal) {
    closeBtn.addEventListener('click', function () {
      paymentModal.style.display = 'none';
      // Show all payment content
      var contents = $$('.payment-content');
      for (var i = 0; i < contents.length; i++) {
        contents[i].style.display = 'block';
      }
    });
  }
}

// ===== INITIALIZE ON PAGE LOAD =====
function initializeLaundrySystem() {
  setupFormListeners();
  setupOrderForm();
  setupConfirmPaymentButtons();
  setupClosePaymentModal();
}

// Call when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeLaundrySystem);
} else {
  initializeLaundrySystem();
}



