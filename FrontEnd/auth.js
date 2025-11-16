// ============================================
// AUTHENTICATION SYSTEM
// ============================================

const API_BASE = 'http://127.0.0.1:8000';
const ORDER_STATUS_FLOW = ['Menunggu Diproses', 'Diproses', 'Dikeringkan', 'Disetrika', 'Selesai', 'Diantar', 'Selesai & diterima'];
const COMPLAINT_STATUSES = ['Menunggu', 'Diproses', 'Selesai'];
let latestUserOrders = [];
let latestUserComplaints = [];
let userMenuCloseListenerBound = false;

function getCurrentUser() {
  const user = localStorage.getItem('currentUser');
  return user ? JSON.parse(user) : null;
}

function resetAuthUI() {
  const authBtn = document.getElementById('authBtn');
  const profileBtn = document.getElementById('userProfileBtn');
  const navUser = document.getElementById('navUserDashboard');
  const navAdmin = document.getElementById('navAdminDashboard');
  const userMenu = document.getElementById('userMenu');
  if (authBtn) authBtn.style.display = 'block';
  if (profileBtn) profileBtn.style.display = 'none';
  if (navUser) navUser.style.display = 'none';
  if (navAdmin) navAdmin.style.display = 'none';
  if (userMenu) userMenu.style.display = 'none';
}

function handleUserMenuClose(e) {
  if (!e.target.closest('#userProfileBtn') && !e.target.closest('#userMenu')) {
    const menu = document.getElementById('userMenu');
    if (menu) menu.style.display = 'none';
  }
}

function hideUserMenu() {
  const menu = document.getElementById('userMenu');
  if (menu) menu.style.display = 'none';
}

// Check if user is logged in
function checkAuth() {
  const userData = getCurrentUser();
  if (userData) {
    updateUIForLoggedInUser(userData);
    return userData;
  }
  resetAuthUI();
  return null;
}

// Update UI when user is logged in
function updateUIForLoggedInUser(user) {
  const authBtn = document.getElementById('authBtn');
  const profileBtn = document.getElementById('userProfileBtn');
  const navUser = document.getElementById('navUserDashboard');
  const navAdmin = document.getElementById('navAdminDashboard');
  if (authBtn) authBtn.style.display = 'none';
  if (profileBtn) profileBtn.style.display = 'block';
  if (navUser) navUser.style.display = user.role === 'user' ? 'inline-block' : 'none';
  if (navAdmin) navAdmin.style.display = user.role === 'admin' ? 'inline-block' : 'none';

  const avatar = user.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.nama) + '&background=00AEEF&color=fff';
  document.getElementById('userAvatarBtn').src = avatar;

  if (profileBtn) {
    profileBtn.onclick = function(e) {
      e.stopPropagation();
      const menu = document.getElementById('userMenu');
      if (!menu) return;
      menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
      document.getElementById('userNameDisplay').textContent = user.nama;
      document.getElementById('userEmailDisplay').textContent = user.email;
      document.getElementById('userAvatar').src = avatar;
    };
  }

  if (!userMenuCloseListenerBound) {
    document.addEventListener('click', handleUserMenuClose);
    userMenuCloseListenerBound = true;
  }
}

function handlePostLogin(user, message = '') {
  updateUIForLoggedInUser(user);
  closeAuthModal();
  if (message) {
    showToast(message, 'success');
  }
  if (user.role === 'admin') {
    showAdminDashboard();
  } else {
    showUserDashboard();
  }
}

// Show auth modal
function showAuthModal() {
  document.getElementById('authModal').style.display = 'flex';
}

// Close auth modal
function closeAuthModal() {
  document.getElementById('authModal').style.display = 'none';
}

// Switch between login and register tabs
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', function() {
    const tabName = this.dataset.tab;
    
    // Update tabs
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    this.classList.add('active');
    
    // Update forms
    document.getElementById('loginForm').style.display = tabName === 'login' ? 'block' : 'none';
    document.getElementById('registerForm').style.display = tabName === 'register' ? 'block' : 'none';
  });
});

// Login form
document.getElementById('loginFormElement')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.detail || result.message || 'Email atau password salah');
    }
    
    localStorage.setItem('currentUser', JSON.stringify(result.user));
    handlePostLogin(result.user, 'Login berhasil!');
  } catch (error) {
    console.error('Login error:', error);
    alert('Terjadi kesalahan saat login. Pastikan backend server berjalan.');
  }
});

// Register form
document.getElementById('registerFormElement')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const userData = {
    nama: document.getElementById('registerName').value,
    email: document.getElementById('registerEmail').value,
    phone: document.getElementById('registerPhone').value,
    password: document.getElementById('registerPassword').value,
    alamat: document.getElementById('registerAddress').value,
    role: document.getElementById('registerRole').value || 'user'
  };
  
  if (userData.password.length < 6) {
    alert('Password minimal 6 karakter');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.detail || result.message || 'Registrasi gagal');
    }
    
    localStorage.setItem('currentUser', JSON.stringify(result.user));
    handlePostLogin(result.user, 'Registrasi berhasil!');
  } catch (error) {
    console.error('Register error:', error);
    alert('Terjadi kesalahan saat registrasi. Pastikan backend server berjalan.');
  }
});

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', function() {
  localStorage.removeItem('currentUser');
  resetAuthUI();
  latestUserOrders = [];
  latestUserComplaints = [];
  const menu = document.getElementById('userMenu');
  if (menu) menu.style.display = 'none';
  
  // Hide profile sections
  document.querySelectorAll('.profile-section, .history-section, .complaints-section, #userDashboard, #adminDashboard').forEach(section => {
    section.style.display = 'none';
  });
  
  // Scroll to home
  window.location.href = '#home';
  showToast('Anda telah logout', 'info');
});

// Auth button click
document.getElementById('authBtn')?.addEventListener('click', showAuthModal);

// Close auth modal
document.getElementById('closeAuthModal')?.addEventListener('click', closeAuthModal);

// Close modal when clicking outside
document.getElementById('authModal')?.addEventListener('click', function(e) {
  if (e.target === this) {
    closeAuthModal();
  }
});

// Profile navigation
document.getElementById('profileLink')?.addEventListener('click', function(e) {
  e.preventDefault();
  showProfilePage();
  hideUserMenu();
});

document.getElementById('historyLink')?.addEventListener('click', function(e) {
  e.preventDefault();
  showHistoryPage();
  hideUserMenu();
});

document.getElementById('complaintsLink')?.addEventListener('click', function(e) {
  e.preventDefault();
  showComplaintsPage();
  hideUserMenu();
});

document.getElementById('navUserDashboard')?.addEventListener('click', function(e) {
  e.preventDefault();
  showUserDashboard();
  hideUserMenu();
});

document.getElementById('navAdminDashboard')?.addEventListener('click', function(e) {
  e.preventDefault();
  showAdminDashboard();
  hideUserMenu();
});

// Show profile page
function showProfilePage() {
  hideAllSections();
  document.getElementById('profile').style.display = 'block';
  
  const user = JSON.parse(localStorage.getItem('currentUser'));
  if (user) {
    document.getElementById('profileName').textContent = user.nama;
    document.getElementById('profileNameInput').value = user.nama;
    document.getElementById('profileEmailInput').value = user.email;
    document.getElementById('profilePhoneInput').value = user.phone || '';
    document.getElementById('profileAddressInput').value = user.alamat || '';
    
    const avatar = user.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.nama) + '&background=00AEEF&color=fff';
    document.getElementById('profileAvatar').src = avatar;
  }
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Show history page
function showHistoryPage() {
  hideAllSections();
  document.getElementById('history').style.display = 'block';
  loadHistory();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Show complaints page
function showComplaintsPage() {
  hideAllSections();
  document.getElementById('complaints').style.display = 'block';
  populateComplaintOrdersSelect(latestUserOrders);
  loadComplaints();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Hide all sections
function hideAllSections() {
  document.querySelectorAll('section').forEach(section => {
    if (!section.id || section.id === 'lokasi') return;
    section.style.display = 'none';
  });
}

// Profile form submit
document.getElementById('profileForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const user = JSON.parse(localStorage.getItem('currentUser'));
  if (!user) {
    alert('Anda harus login terlebih dahulu');
    return;
  }
  
  const updatedData = {
    id: user.id,
    nama: document.getElementById('profileNameInput').value,
    email: document.getElementById('profileEmailInput').value,
    phone: document.getElementById('profilePhoneInput').value,
    alamat: document.getElementById('profileAddressInput').value
  };
  
  try {
    const response = await fetch(`${API_BASE}/auth/update-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData)
    });
    
    const result = await response.json();
    
    if (result.success) {
      localStorage.setItem('currentUser', JSON.stringify(result.user));
      updateUIForLoggedInUser(result.user);
      showToast('Profil berhasil diperbarui!', 'success');
    } else {
      alert(result.message || 'Gagal memperbarui profil');
    }
  } catch (error) {
    console.error('Update profile error:', error);
    alert('Terjadi kesalahan saat memperbarui profil');
  }
});

// Avatar upload
document.getElementById('avatarUpload')?.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const avatarUrl = e.target.result;
      document.getElementById('profileAvatar').src = avatarUrl;
      
      // Save to localStorage
      const user = JSON.parse(localStorage.getItem('currentUser'));
      if (user) {
        user.avatar = avatarUrl;
        localStorage.setItem('currentUser', JSON.stringify(user));
        updateUIForLoggedInUser(user);
      }
    };
    reader.readAsDataURL(file);
  }
});

// Load history
async function loadHistory() {
  const user = getCurrentUser();
  if (!user) return;
  
  try {
    const response = await fetch(`${API_BASE}/orders/user/${user.id}`);
    const orders = await response.json();
    latestUserOrders = orders;
    populateComplaintOrdersSelect(orders);
    renderUserOrdersTable(orders, latestUserComplaints);
    
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '';
    
    if (orders.length === 0) {
      historyList.innerHTML = '<p style="text-align: center; color: var(--text-gray);">Belum ada pesanan</p>';
      return;
    }
    
    orders.forEach(order => {
      const item = createHistoryItem(order);
      historyList.appendChild(item);
    });
  } catch (error) {
    console.error('Load history error:', error);
  }
}

// Create history item
function createHistoryItem(order) {
  const div = document.createElement('div');
  div.className = 'history-item';
  div.dataset.status = order.status || '';
  
  const isCompleted = order.status === 'Selesai' || order.status === 'completed';
  const statusClass = isCompleted ? 'status-completed' : 'status-active';
  const statusText = getStatusText(order.status);
  const layananText = (order.layanan || '').toLowerCase();
  const usesWeight = ['reguler', 'express', 'kilat', 'laundry'].some(keyword => layananText.includes(keyword));
  const quantityValue = order.jumlah || order.berat || 0;
  const quantityLabel = usesWeight ? `${quantityValue} kg` : `${quantityValue || 1} item`;
  
  div.innerHTML = `
    <div class="history-item-header">
      <div>
        <div class="history-item-id">Pesanan #${order.id}</div>
        <div style="color: var(--text-gray); margin-top: 0.5rem;">
          ${order.layanan} • ${quantityLabel} • ${formatCurrency(order.total)}
        </div>
        <div style="color: var(--text-gray); font-size: 0.85rem;">
          ${order.metodePembayaran || 'Metode pembayaran tidak tersedia'}
        </div>
      </div>
      <span class="history-item-status ${statusClass}">${statusText}</span>
    </div>
    ${!isCompleted ? createTrackingProgress(order) : ''}
    <div style="margin-top: 1rem; font-size: 0.9rem; color: var(--text-gray);">
      ${new Date(order.waktu).toLocaleDateString('id-ID')}
    </div>
  `;
  
  return div;
}

// Create tracking progress
function createTrackingProgress(order) {
  const steps = ORDER_STATUS_FLOW;
  const currentIndex = Math.max(steps.indexOf(order.status), 0);
  const progress = ((currentIndex + 1) / steps.length) * 100;
  
  return `
    <div class="tracking-progress">
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${progress}%"></div>
      </div>
      <div class="progress-steps">
        ${steps.map((name, idx) => 
          `<span style="${idx <= currentIndex ? 'color: var(--primary-blue); font-weight: 600;' : ''}">${name}</span>`
        ).join('')}
      </div>
    </div>
  `;
}

// Get status text
function getStatusText(status) {
  // Jika sudah dalam format yang benar, return langsung
  if (ORDER_STATUS_FLOW.includes(status)) {
    return status;
  }
  const statusMap = {
    'pending': 'Menunggu Diproses',
    'active': 'Dalam Proses',
    'completed': 'Selesai',
    'Menunggu Diproses': 'Menunggu Diproses',
    'Diproses': 'Diproses',
    'Dikeringkan': 'Dikeringkan',
    'Disetrika': 'Disetrika',
    'Selesai': 'Selesai',
    'Diantar': 'Diantar',
    'Selesai & diterima': 'Selesai & Diterima'
  };
  return statusMap[status] || status || 'Tidak diketahui';
}

// Load complaints
async function loadComplaints() {
  const user = getCurrentUser();
  if (!user) return;
  
  try {
    const response = await fetch(`${API_BASE}/complaints/user/${user.id}`);
    const complaints = await response.json();
    latestUserComplaints = complaints;
    renderUserComplaintsTable(complaints);
    renderUserOrdersTable(latestUserOrders, complaints);
    renderComplaintCards(complaints);
  } catch (error) {
    console.error('Load complaints error:', error);
  }
}

function renderComplaintCards(complaints) {
  const complaintsList = document.getElementById('complaintsList');
  if (!complaintsList) return;
  complaintsList.innerHTML = '';
  
  if (!complaints.length) {
    complaintsList.innerHTML = '<p style="text-align: center; color: var(--text-gray);">Belum ada keluhan</p>';
    return;
  }
  
  complaints.forEach(complaint => {
    complaintsList.appendChild(createComplaintItem(complaint));
  });
}

// Create complaint item
function createComplaintItem(complaint) {
  const div = document.createElement('div');
  div.className = 'complaint-item';
  
  const statusMap = {
    'Menunggu': 'status-pending',
    'Diproses': 'status-processing',
    'Selesai': 'status-resolved'
  };
  const statusClass = statusMap[complaint.status] || 'status-pending';
  const statusText = complaint.status || 'Menunggu';
  
  div.innerHTML = `
    <div class="complaint-ticket">${complaint.ticketId}</div>
    <div style="font-weight: 600; margin-bottom: 0.5rem;">${complaint.kategori}</div>
    <div style="color: var(--text-gray); margin-bottom: 0.5rem;">${complaint.deskripsi}</div>
    <div style="font-size: 0.85rem; color: var(--text-gray);">Pesanan: ${complaint.orderId}</div>
    ${complaint.rating ? `<div style="margin-top: 0.5rem;">Rating: ${'⭐'.repeat(complaint.rating)}</div>` : ''}
    ${complaint.balasanAdmin ? `<div class="complaint-response"><strong>Balasan Admin:</strong><br>${complaint.balasanAdmin}</div>` : ''}
    <span class="complaint-status ${statusClass}">${statusText}</span>
  `;
  
  return div;
}

// Complaint form submit
document.getElementById('complaintForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const user = getCurrentUser();
  if (!user) {
    alert('Anda harus login terlebih dahulu');
    return;
  }
  
  const orderId = document.getElementById('complaintOrderId').value;
  if (!orderId) {
    alert('Pilih pesanan yang ingin dikomplain');
    return;
  }
  
  const fileInput = document.getElementById('complaintPhoto');
  let photoData = '';
  if (fileInput?.files?.length) {
    photoData = await fileToBase64(fileInput.files[0]);
  }
  
  const complaintData = {
    userId: user.id,
    orderId,
    kategori: document.getElementById('complaintCategory').value,
    deskripsi: document.getElementById('complaintDescription').value,
    rating: parseInt(document.getElementById('complaintRating').value, 10),
    foto: photoData || undefined
  };
  
  try {
    const response = await fetch(`${API_BASE}/complaints/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(complaintData)
    });
    
    const result = await response.json();
    
    if (result.success) {
      document.getElementById('complaintForm').reset();
      loadComplaints();
      loadUserDashboard();
      showToast('Keluhan berhasil dikirim!', 'success');
    } else {
      alert(result.message || 'Gagal mengirim keluhan');
    }
  } catch (error) {
    console.error('Submit complaint error:', error);
    alert('Terjadi kesalahan saat mengirim keluhan');
  }
});

function showUserDashboard() {
  try { if (typeof closeComplaintsOverlay === 'function') closeComplaintsOverlay(); } catch(e){}
  const user = getCurrentUser();
  if (!user) {
    showAuthModal();
    return;
  }
  if (user.role !== 'user') {
    showToast('Halaman ini hanya untuk pengguna.', 'error');
    return;
  }
  const section = document.getElementById('userDashboard');
  if (section) {
    section.style.display = 'block';
    section.scrollIntoView({ behavior: 'smooth' });
  }
  loadUserDashboard();
}

function showAdminDashboard() {
  try { if (typeof closeComplaintsOverlay === 'function') closeComplaintsOverlay(); } catch(e){}
  const user = getCurrentUser();
  if (!user) {
    showAuthModal();
    return;
  }
  if (user.role !== 'admin') {
    showToast('Hanya admin yang dapat mengakses panel ini.', 'error');
    return;
  }
  const section = document.getElementById('adminDashboard');
  if (section) {
    section.style.display = 'block';
    section.scrollIntoView({ behavior: 'smooth' });
  }
  loadAdminDashboard();
}

async function loadUserDashboard() {
  const user = getCurrentUser();
  if (!user || user.role !== 'user') return;
  try {
    const [ordersRes, complaintsRes] = await Promise.all([
      fetch(`${API_BASE}/orders/user/${user.id}`),
      fetch(`${API_BASE}/complaints/user/${user.id}`)
    ]);
    const [orders, complaints] = await Promise.all([ordersRes.json(), complaintsRes.json()]);
    latestUserOrders = orders;
    latestUserComplaints = complaints;
    renderUserOrdersTable(orders, complaints);
    renderUserComplaintsTable(complaints);
    renderComplaintCards(complaints);
    populateComplaintOrdersSelect(orders);
  } catch (error) {
    console.error('Load user dashboard error:', error);
  }
}

const TRACKING_STEPS = [
  { key: 'Menunggu Diproses', label: 'Menunggu Diproses', icon: '⏳' },
  { key: 'Diproses', label: 'Diproses (Dicuci)', icon: '🧺' },
  { key: 'Dikeringkan', label: 'Dikeringkan', icon: '☀️' },
  { key: 'Disetrika', label: 'Disetrika', icon: '🔥' },
  { key: 'Selesai', label: 'Selesai', icon: '✅' },
  { key: 'Diantar', label: 'Diantar', icon: '🚚' },
  { key: 'Selesai & diterima', label: 'Selesai & Diterima', icon: '🎉' }
];

function getStatusPillClass(status) {
  const map = {
    'Menunggu Diproses': 'status-menunggu',
    'Menunggu': 'status-menunggu',
    'Diproses': 'status-dicuci',
    'Dicuci': 'status-dicuci',
    'Dikeringkan': 'status-dikeringkan',
    'Disetrika': 'status-disetrika',
    'Siap Diambil': 'status-siap',
    'Selesai': 'status-selesai',
    'Diantar': 'status-diantar',
    'Selesai & diterima': 'status-selesai'
  };
  if (status && map[status]) return map[status];
  if (status === 'completed') return 'status-selesai';
  return 'status-menunggu';
}

function renderUserOrdersTable(orders = [], complaints = []) {
  const tbody = document.querySelector('#userOrdersTable tbody');
  if (!tbody) return;
  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Belum ada pesanan</td></tr>';
    return;
  }
  const complaintsMap = complaints.reduce((acc, item) => {
    acc[item.orderId] = item;
    return acc;
  }, {});
  
  tbody.innerHTML = orders.map(order => {
    const statusClass = getStatusPillClass(order.status);
    const complaint = complaintsMap[order.id];
    const isCompleted = order.status === 'Selesai' || order.status === 'Selesai & diterima';
    let action = `<button class="btn-outline btn-track-order" data-order="${order.id}">Lacak</button>`;
    
    if (isCompleted) {
      if (complaint) {
        action = '<span class="status-pill status-selesai">Sudah direview</span>';
      } else {
        action = `<button class="btn-primary btn-review-order" data-order="${order.id}">Berikan Review</button>`;
      }
    }
    
    return `
      <tr>
        <td>${order.id}</td>
        <td>${order.layanan}<br><small>${order.catatan || ''}</small></td>
        <td>${formatCurrency(order.total)}</td>
        <td><span class="status-pill ${statusClass}">${getStatusText(order.status)}</span></td>
        <td>${action}</td>
      </tr>
    `;
  }).join('');
  
  tbody.querySelectorAll('.btn-track-order').forEach(btn => {
    btn.addEventListener('click', () => showTrackingModal(btn.dataset.order));
  });
  
  tbody.querySelectorAll('.btn-review-order').forEach(btn => {
    btn.addEventListener('click', () => showReviewModal(btn.dataset.order));
  });
  
  tbody.querySelectorAll('.btn-create-complaint').forEach(btn => {
    btn.addEventListener('click', () => openComplaintForOrder(btn.dataset.order));
  });
}

function renderUserComplaintsTable(complaints = []) {
  const tbody = document.querySelector('#userComplaintsTable tbody');
  if (!tbody) return;
  if (!complaints.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Belum ada keluhan</td></tr>';
    return;
  }
  tbody.innerHTML = complaints.map(complaint => `
    <tr>
      <td>${complaint.ticketId}</td>
      <td>${complaint.kategori}</td>
      <td><span class="complaint-status ${getStatusPillClass(complaint.status)}">${complaint.status}</span></td>
      <td>${complaint.balasanAdmin || '-'}</td>
    </tr>
  `).join('');
}

function populateComplaintOrdersSelect(orders = []) {
  const select = document.getElementById('complaintOrderId');
  if (!select) return;
  const completedOrders = orders.filter(order => order.status === 'Selesai');
  select.innerHTML = '<option value="">Pilih pesanan selesai</option>';
  completedOrders.forEach(order => {
    const option = document.createElement('option');
    option.value = order.id;
    option.textContent = `${order.id} - ${order.layanan}`;
    select.appendChild(option);
  });
  select.disabled = completedOrders.length === 0;
}

function openComplaintForOrder(orderId) {
  populateComplaintOrdersSelect(latestUserOrders);
  const select = document.getElementById('complaintOrderId');
  if (select) {
    select.value = orderId;
  }
  showComplaintsPage();
}

async function loadAdminDashboard() {
  const user = getCurrentUser();
  if (!user || user.role !== 'admin') return;
  
  try {
    const [ordersRes, complaintsRes] = await Promise.all([fetch(`${API_BASE}/orders`), fetch(`${API_BASE}/complaints`)]);
    const [orders, complaints] = await Promise.all([ordersRes.json(), complaintsRes.json()]);
    renderAdminOrdersTable(orders);
    renderAdminComplaintsTable(complaints);
  } catch (error) {
    console.error('Load admin dashboard error:', error);
  }
}

function renderAdminOrdersTable(orders = []) {
  const tbody = document.querySelector('#adminOrdersTable tbody');
  if (!tbody) return;
  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Belum ada pesanan</td></tr>';
    return;
  }
  tbody.innerHTML = orders.map(order => `
    <tr>
      <td>${order.id}</td>
      <td>${order.userName || '-'}</td>
      <td>${order.layanan}</td>
      <td>${formatCurrency(order.total)}</td>
      <td><span class="status-pill ${getStatusPillClass(order.status)}">${getStatusText(order.status)}</span></td>
      <td>
        <select class="admin-status-select" data-order="${order.id}">
          ${ORDER_STATUS_FLOW.map(status => `<option value="${status}" ${status === order.status ? 'selected' : ''}>${status}</option>`).join('')}
        </select>
        <button class="btn-outline btn-update-status" data-order="${order.id}">Update</button>
      </td>
    </tr>
  `).join('');
  
  tbody.querySelectorAll('.btn-update-status').forEach(btn => {
    btn.addEventListener('click', async function() {
      const orderId = this.dataset.order;
      const select = tbody.querySelector(`.admin-status-select[data-order="${orderId}"]`);
      if (select) {
        await updateOrderStatus(orderId, select.value);
      }
    });
  });
}

function renderAdminComplaintsTable(complaints = []) {
  const tbody = document.querySelector('#adminComplaintsTable tbody');
  if (!tbody) return;
  if (!complaints.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Belum ada keluhan</td></tr>';
    return;
  }
  tbody.innerHTML = complaints.map(complaint => `
    <tr>
      <td>${complaint.ticketId}<br><small>${complaint.orderId}</small></td>
      <td>${complaint.kategori}</td>
      <td><span class="status-pill ${getStatusPillClass(complaint.status)}">${complaint.status}</span></td>
      <td>${complaint.deskripsi}</td>
      <td>
        <select class="admin-complaint-status" data-ticket="${complaint.ticketId}">
          ${COMPLAINT_STATUSES.map(status => `<option value="${status}" ${status === complaint.status ? 'selected' : ''}>${status}</option>`).join('')}
        </select>
        <textarea class="admin-reply-input" data-ticket="${complaint.ticketId}" placeholder="Balasan admin...">${complaint.balasanAdmin || ''}</textarea>
        <button class="btn-outline btn-update-complaint" data-ticket="${complaint.ticketId}">Simpan</button>
      </td>
    </tr>
  `).join('');
  
  tbody.querySelectorAll('.btn-update-complaint').forEach(btn => {
    btn.addEventListener('click', async function() {
      const ticketId = this.dataset.ticket;
      const statusSelect = tbody.querySelector(`.admin-complaint-status[data-ticket="${ticketId}"]`);
      const replyInput = tbody.querySelector(`.admin-reply-input[data-ticket="${ticketId}"]`);
      await updateComplaint(ticketId, statusSelect?.value, replyInput?.value || '');
    });
  });
}

async function updateOrderStatus(orderId, status) {
  try {
    const response = await fetch(`${API_BASE}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.detail || result.message || 'Gagal memperbarui status');
    }
    showToast(`Status pesanan ${orderId} diperbarui`, 'success');
    loadAdminDashboard();
  } catch (error) {
    console.error('Update order error:', error);
    alert(error.message || 'Gagal memperbarui status pesanan');
  }
}

async function updateComplaint(ticketId, status, balasan) {
  try {
    const response = await fetch(`${API_BASE}/complaints/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, balasanAdmin: balasan })
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.detail || result.message || 'Gagal memperbarui keluhan');
    }
    showToast(`Keluhan ${ticketId} diperbarui`, 'success');
    loadAdminDashboard();
    loadComplaints();
  } catch (error) {
    console.error('Update complaint error:', error);
    alert(error.message || 'Gagal memperbarui keluhan');
  }
}

// History tabs
document.querySelectorAll('.history-tab').forEach(tab => {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.history-tab').forEach(t => t.classList.remove('active'));
    this.classList.add('active');
    // Filter history by status
    const status = this.dataset.status;
    filterHistory(status);
  });
});

function filterHistory(status) {
  const items = document.querySelectorAll('.history-item');
  items.forEach(item => {
    if (status === 'all') {
      item.style.display = 'block';
    } else {
      const itemStatus = (item.dataset.status || '').toLowerCase();
      if (status === 'active') {
        item.style.display = itemStatus === 'selesai' || itemStatus === 'completed' ? 'none' : 'block';
      } else if (status === 'completed') {
        item.style.display = itemStatus === 'selesai' || itemStatus === 'completed' ? 'block' : 'none';
      } else {
        item.style.display = 'block';
      }
    }
  });
}

document.getElementById('refreshUserOrders')?.addEventListener('click', loadUserDashboard);
document.getElementById('refreshUserComplaints')?.addEventListener('click', loadComplaints);
document.getElementById('refreshAdminOrders')?.addEventListener('click', loadAdminDashboard);
document.getElementById('refreshAdminComplaints')?.addEventListener('click', loadAdminDashboard);

// Toast notification
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    animation: slideInRight 0.3s ease-out;
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Format currency helper
function formatCurrency(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
}

// ====================== TRACKING & REVIEW ======================
async function showTrackingModal(orderId) {
  try {
    const response = await fetch(`${API_BASE}/orders/tracking/${orderId}`);
    const order = await response.json();
    
    document.getElementById('trackingOrderId').textContent = `Pesanan #${order.id}`;
    
    const currentStatus = order.status || order.tracking_step || 'Menunggu Diproses';
    const currentIndex = TRACKING_STEPS.findIndex(s => s.key === currentStatus);
    
    const stepsHtml = TRACKING_STEPS.map((step, idx) => {
      const isActive = idx <= currentIndex;
      const isCurrent = idx === currentIndex;
      return `
        <div class="tracking-step ${isActive ? 'active' : ''} ${isCurrent ? 'current' : ''}">
          <div class="step-icon">${step.icon}</div>
          <div class="step-label">${step.label}</div>
        </div>
      `;
    }).join('');
    
    document.getElementById('trackingSteps').innerHTML = stepsHtml;
    document.getElementById('trackingStatus').textContent = `Status saat ini: ${currentStatus}`;
    document.getElementById('trackingModal').classList.add('active');
  } catch (error) {
    console.error('Error loading tracking:', error);
    alert('Gagal memuat tracking pesanan');
  }
}

function closeTrackingModal() {
  document.getElementById('trackingModal').classList.remove('active');
}

function showReviewModal(orderId) {
  document.getElementById('reviewOrderId').value = orderId;
  document.getElementById('reviewModal').classList.add('active');
  
  // Reset form
  document.getElementById('reviewRating').value = '5';
  document.getElementById('reviewComment').value = '';
  document.getElementById('reviewPhoto').value = '';
  
  // Update stars
  document.querySelectorAll('.star').forEach((star, idx) => {
    star.classList.toggle('active', idx < 5);
  });
}

function closeReviewModal() {
  document.getElementById('reviewModal').classList.remove('active');
}

// Rating stars interaction
document.querySelectorAll('.star').forEach(star => {
  star.addEventListener('click', function() {
    const rating = parseInt(this.dataset.rating);
    document.getElementById('reviewRating').value = rating;
    document.querySelectorAll('.star').forEach((s, idx) => {
      s.classList.toggle('active', idx < rating);
    });
  });
});

// Review form submit
document.getElementById('reviewForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  const orderId = document.getElementById('reviewOrderId').value;
  const rating = parseInt(document.getElementById('reviewRating').value);
  const comment = document.getElementById('reviewComment').value;
  const photoInput = document.getElementById('reviewPhoto');
  
  let photoData = '';
  if (photoInput?.files?.length) {
    photoData = await fileToBase64(photoInput.files[0]);
  }
  
  const user = getCurrentUser();
  const payload = {
    orderId,
    userId: user?.id || null,
    kategori: 'Review',
    deskripsi: comment || 'Review positif',
    rating,
    foto: photoData || undefined,
    isReview: true
  };
  
  try {
    const response = await fetch(`${API_BASE}/complaints/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    if (result.success) {
      showToast('Terima kasih atas review Anda!', 'success');
      closeReviewModal();
      if (typeof loadUserDashboard === 'function') loadUserDashboard();
    } else {
      alert(result.detail || 'Gagal mengirim review');
    }
  } catch (error) {
    console.error('Submit review error:', error);
    alert('Terjadi kesalahan saat mengirim review');
  }
});

// Complaint button in review modal
document.getElementById('submitComplaintBtn')?.addEventListener('click', function() {
  const orderId = document.getElementById('reviewOrderId').value;
  closeReviewModal();
  openComplaintForOrder(orderId);
});

// Modal close handlers
document.getElementById('closeTrackingModal')?.addEventListener('click', closeTrackingModal);
document.getElementById('closeReviewModal')?.addEventListener('click', closeReviewModal);

// When user clicks "Saya sudah bayar" on success modal, open review modal for that order
document.getElementById('paidBtn')?.addEventListener('click', function () {
  try {
    // successOrderId element contains HTML like: 'Nomor Pesanan: <strong>ORD-...'
    var el = document.getElementById('successOrderId');
    if (!el) return;
    var txt = el.textContent || '';
    // Extract first word that looks like an order id (starts with ORD-)
    var m = txt.match(/ORD-[0-9A-Za-z\-]+/);
    var orderId = m ? m[0] : (el.querySelector && el.querySelector('strong') ? (el.querySelector('strong').textContent || '') : '');
    if (!orderId) {
      // fallback: close success modal and notify
      closeSuccessModal();
      showToast('Nomor pesanan tidak ditemukan untuk review.', 'error');
      return;
    }

    closeSuccessModal();
    // Open review modal with that order id
    showReviewModal(orderId);
  } catch (e) {
    console.error('paidBtn handler error', e);
  }
});

// Post-payment menu handlers
document.getElementById('giveReviewBtn')?.addEventListener('click', function() {
  try {
    var el = document.getElementById('successOrderId');
    if (!el) return;
    var txt = el.textContent || '';
    var m = txt.match(/ORD-[0-9A-Za-z\-]+/);
    var orderId = m ? m[0] : (el.querySelector && el.querySelector('strong') ? (el.querySelector('strong').textContent || '') : '');
    
    if (!orderId) {
      showToast('Nomor pesanan tidak ditemukan.', 'error');
      return;
    }

    closeSuccessModal();
    showReviewModal(orderId);
  } catch (e) {
    console.error('giveReviewBtn error', e);
  }
});

document.getElementById('viewHistoryBtn')?.addEventListener('click', function() {
  closeSuccessModal();
  showHistorySection();
});

document.getElementById('viewComplaintsBtn')?.addEventListener('click', function() {
  closeSuccessModal();
  showComplaintsSection();
});

document.getElementById('trackingModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeTrackingModal();
});

document.getElementById('reviewModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeReviewModal();
});

// ====================== NAVIGATION HANDLERS ======================
// Show History Section
function showHistorySection() {
  try { if (typeof closeComplaintsOverlay === 'function') closeComplaintsOverlay(); } catch(e){}
  const user = getCurrentUser();
  if (!user) {
    showAuthModal();
    return;
  }
  
  // Hide all sections first
  document.getElementById('userDashboard')?.style.display === 'none' ? document.getElementById('userDashboard').style.display = 'block' : null;
  document.getElementById('history')?.style.display = 'block';
  document.getElementById('tracking')?.style.display = 'none';
  document.getElementById('complaints')?.style.display = 'none';
  
  // Scroll to history
  document.getElementById('history')?.scrollIntoView({ behavior: 'smooth' });
  
  // Load orders for history
  loadUserDashboard();
}

// Show Complaints Section
async function showComplaintsSection() {
  const user = getCurrentUser();
  if (!user) {
    showAuthModal();
    return;
  }
  
  // Hide all sections first
  document.getElementById('userDashboard')?.style.display === 'none' ? document.getElementById('userDashboard').style.display = 'block' : null;
  document.getElementById('history')?.style.display = 'none';
  document.getElementById('tracking')?.style.display = 'none';
  const complaintsEl = document.getElementById('complaints');
  if (!complaintsEl) return;

  // Load complaints and user orders first (populates select)
  await loadUserDashboardIfNeeded();

  // Show as overlay centered on screen (so it appears 'di gambar')
  complaintsEl.style.display = 'block';
  complaintsEl.classList.add('overlay-mode');

  // add backdrop
  if (!document.querySelector('.complaints-overlay-backdrop')) {
    const bd = document.createElement('div');
    bd.className = 'complaints-overlay-backdrop';
    bd.addEventListener('click', closeComplaintsOverlay);
    document.body.appendChild(bd);
  }

  // attach outside-click handler to close when clicking outside the form card
  setTimeout(() => {
    document.addEventListener('click', complaintsOutsideClickHandler);
  }, 50);

  // ensure complaint select is up-to-date
  populateComplaintOrdersSelect(latestUserOrders);
}

// Close overlay and cleanup
function closeComplaintsOverlay() {
  const complaintsEl = document.getElementById('complaints');
  if (!complaintsEl) return;
  complaintsEl.classList.remove('overlay-mode');
  complaintsEl.style.display = 'none';
  const bd = document.querySelector('.complaints-overlay-backdrop');
  if (bd) bd.remove();
  document.removeEventListener('click', complaintsOutsideClickHandler);
}

function complaintsOutsideClickHandler(e) {
  const complaintsEl = document.getElementById('complaints');
  if (!complaintsEl) return;
  const card = complaintsEl.querySelector('.complaint-form-card');
  if (!card) return;
  if (!card.contains(e.target) && !complaintsEl.contains(e.target)) {
    closeComplaintsOverlay();
  }
}

async function loadUserDashboardIfNeeded() {
  const user = getCurrentUser();
  if (!user) return;
  // if latestUserOrders is empty, load; otherwise refresh complaints/orders
  if (!latestUserOrders || !latestUserOrders.length) {
    await loadUserDashboard();
  } else {
    // still refresh complaints and orders to have latest data
    await loadUserDashboard();
  }
}

// Setup menu links
document.getElementById('historyLink')?.addEventListener('click', function(e) {
  e.preventDefault();
  hideUserMenu();
  showHistorySection();
});

document.getElementById('complaintsLink')?.addEventListener('click', function(e) {
  e.preventDefault();
  hideUserMenu();
  showComplaintsSection();
});

// History tab filtering
document.querySelectorAll('.history-tab').forEach(tab => {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.history-tab').forEach(t => t.classList.remove('active'));
    this.classList.add('active');
    const status = this.dataset.status;
    filterHistoryByStatus(status);
  });
});

function filterHistoryByStatus(status) {
  const items = document.querySelectorAll('.history-item');
  items.forEach(item => {
    const itemStatus = (item.dataset.status || '').toLowerCase();
    if (status === 'all') {
      item.style.display = 'block';
    } else if (status === 'active') {
      item.style.display = (itemStatus === 'selesai' || itemStatus === 'completed') ? 'none' : 'block';
    } else if (status === 'completed') {
      item.style.display = (itemStatus === 'selesai' || itemStatus === 'completed') ? 'block' : 'none';
    }
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  // Hide splash screen after 3 seconds
  setTimeout(() => {
    document.getElementById('splashScreen').style.display = 'none';
  }, 3000);
  
  // Check auth
  const user = checkAuth();
  if (user?.role === 'user') {
    loadHistory();
    loadComplaints();
  } else if (user?.role === 'admin') {
    loadAdminDashboard();
  }
});


