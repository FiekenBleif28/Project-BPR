// ========= ADMIN DASHBOARD SCRIPT =========

// HTML container
const orderList = document.getElementById("orderList");

// FETCH data orders
function loadOrders() {
    fetch("http://localhost:3001/orders")
        .then(res => res.json())
        .then(data => {
            renderOrders(data);
        })
        .catch(() => {
            orderList.innerHTML = "<p style='color:red;'>Gagal memuat data.</p>";
        });
}

// Tampilkan data ke admin.html
function renderOrders(orders) {
    if (orders.length === 0) {
        orderList.innerHTML = "<p>Tidak ada pesanan.</p>";
        return;
    }

    orderList.innerHTML = "";

    orders.forEach(order => {
        const card = document.createElement("div");
        card.className = "order-card";

        card.innerHTML = `
            <div>
                <strong>${order.name}</strong> - ${order.service}<br>
                <small>${order.quantity} ${order.unit} | Rp ${order.total.toLocaleString()}</small>
            </div>

            <div style="display:flex; gap:10px; align-items:center;">
                <select onchange="updateStatus(${order.id}, this.value)">
                    <option value="Pending" ${order.status === "Pending" ? "selected" : ""}>Pending</option>
                    <option value="Proses" ${order.status === "Proses" ? "selected" : ""}>Proses</option>
                    <option value="Selesai" ${order.status === "Selesai" ? "selected" : ""}>Selesai</option>
                </select>

                <button class="btn-delete" onclick="deleteOrder(${order.id})">Hapus</button>
            </div>
        `;

        orderList.appendChild(card);
    });
}

// UPDATE status pesanan
function updateStatus(id, newStatus) {
    fetch(`http://localhost:3001/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
    })
        .then(() => loadOrders())
        .catch(() => alert("Gagal update status!"));
}

// DELETE pesanan
function deleteOrder(id) {
    if (!confirm("Yakin ingin menghapus pesanan ini?")) return;

    fetch(`http://localhost:3001/orders/${id}`, { method: "DELETE" })
        .then(() => loadOrders())
        .catch(() => alert("Gagal menghapus pesanan!"));
}

// Jalankan saat halaman dibuka
loadOrders();
