const API_URL = "http://localhost:8080";

document.addEventListener("DOMContentLoaded", () => {
    loadOrders();
    loadComplaints();
});

/* =======================================================
   LOAD ORDERS
======================================================= */
async function loadOrders() {
    const tbody = document.getElementById("ordersTable");
    if (!tbody) return;

    try {
        const res = await fetch(`${API_URL}/orders`);
        if (!res.ok) throw new Error("Gagal mengambil data orders");
        const orders = await res.json();

        tbody.innerHTML = "";
        orders.forEach(o => {
            // Tentukan info pembayaran
            let paymentInfo = "";
            if (o.metodePembayaran === "va") {
                paymentInfo = `VA: ${o.vaNumber} (${o.bankName})`;
            } else if (o.metodePembayaran === "qris") {
                paymentInfo = "QRIS";
            } else {
                paymentInfo = o.metodePembayaran;
            }

            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${o.id}</td>
                <td>${o.userName}</td>
                <td>${o.layanan}</td>
                <td>${o.statusPembayaran}</td>
                <td>${o.jumlah}</td>
                <td>${o.berat}</td>
                <td>${o.alamat}</td>
                <td>${o.catatan || '-'}</td>
                <td>${o.phone}</td>
                <td>${o.metodePembayaran}</td>
                <td>${paymentInfo}</td>
                <td>Rp ${o.total.toLocaleString()}</td>
                <td><button class="btn" onclick="openOrderModal('${o.id}', '${o.status}')">Ubah</button></td>
                <td>${o.status}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        console.error("Error loadOrders:", err);
    }
}


/* =======================================================
   MODAL ORDER
======================================================= */
let selectedOrderId = null;

function openOrderModal(orderId, status) {
    selectedOrderId = orderId;
    const modal = document.getElementById("orderModal");
    document.getElementById("modalOrderId").innerText = orderId;
    document.getElementById("modalStatus").value = status;
    modal.style.display = "flex";
}

function closeOrderModal() {
    document.getElementById("orderModal").style.display = "none";
}

async function saveOrderStatus() {
    const newStatus = document.getElementById("modalStatus").value;
    if (!selectedOrderId) return;

    try {
        const res = await fetch(`${API_URL}/orders/${selectedOrderId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus })
        });
        if (!res.ok) throw new Error("Gagal update order");
        await loadOrders();
        closeOrderModal();
        alert("Status berhasil diperbarui!");
    } catch (err) {
        console.error(err);
        alert("Gagal memperbarui status!");
    }
}

/* =======================================================
   LOAD COMPLAINTS
======================================================= */
async function loadComplaints() {
    const tbody = document.getElementById("complaintsTable");
    if (!tbody) return;

    try {
        const res = await fetch(`${API_URL}/complaints`);
        if (!res.ok) throw new Error("Gagal mengambil data complaints");
        const complaints = await res.json();

        tbody.innerHTML = "";
        complaints.forEach(c => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${c.ticketId}</td>
                <td>${c.orderId}</td>
                <td>${c.kategori}</td>
                <td>${c.deskripsi}</td>
                <td>
                    ${c.foto ? `<img src="${c.foto}" alt="Foto Keluhan" style="width:60px; cursor:pointer;" onclick="viewComplaintPhoto('${c.foto}')">` : "Tidak ada"}
                </td>
                <td>${c.status}</td>
                <td>${c.rating}</td>
                <td><button class="btn" onclick="openComplaintModal('${c.ticketId}', \`${c.balasanAdmin || ""}\`)">Balas</button></td>
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        console.error("Error loadComplaints:", err);
    }
}

/* =======================================================
   MODAL COMPLAINT
======================================================= */
let selectedTicketId = null;

function openComplaintModal(ticketId, balasan) {
    selectedTicketId = ticketId;
    document.getElementById("modalTicketId").innerText = ticketId;
    document.getElementById("modalBalasan").value = balasan;
    document.getElementById("complaintModal").style.display = "flex";
}

function closeComplaintModal() {
    document.getElementById("complaintModal").style.display = "none";
}

async function saveComplaintReply() {
    if (!selectedTicketId) return;
    const balasan = document.getElementById("modalBalasan").value;

    try {
        const res = await fetch(`${API_URL}/complaints/${selectedTicketId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ balasanAdmin: balasan, status: "Dibalas" })
        });
        if (!res.ok) throw new Error("Gagal update complaint");
        await loadComplaints();
        closeComplaintModal();
        alert("Balasan terkirim!");
    } catch (err) {
        console.error(err);
        alert("Gagal mengirim balasan!");
    }
}

// Hapus order
async function deleteOrder(orderId) {
    if (!confirm(`Apakah Anda yakin ingin menghapus order ${orderId}?`)) return;
    try {
        const res = await fetch(`${API_URL}/orders/${orderId}`, {
            method: "DELETE"
        });
        if (!res.ok) throw new Error("Gagal menghapus order");
        await loadOrders();
        alert("Order berhasil dihapus!");
    } catch (err) {
        console.error(err);
        alert("Gagal menghapus order!");
    }
}

// Hapus complaint
async function deleteComplaint(ticketId) {
    if (!confirm(`Apakah Anda yakin ingin menghapus complaint ${ticketId}?`)) return;
    try {
        const res = await fetch(`${API_URL}/complaints/${ticketId}`, {
            method: "DELETE"
        });
        if (!res.ok) throw new Error("Gagal menghapus complaint");
        await loadComplaints();
        alert("Complaint berhasil dihapus!");
    } catch (err) {
        console.error(err);
        alert("Gagal menghapus complaint!");
    }
}

