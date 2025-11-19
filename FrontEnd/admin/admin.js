async function loadOrders() {
    const container = document.getElementById("ordersList");
    container.innerHTML = "Loading...";

    try {
        const res = await fetch("/complaints")

        const orders = await res.json();

        if (orders.length === 0) {
            container.innerHTML = "<p>Tidak ada orders.</p>";
            return;
        }

        container.innerHTML = "";
        orders.forEach(order => {
            const div = document.createElement("div");
            div.className = "item";
            div.innerHTML = `
                <p><strong>ID:</strong> ${order.id}</p>
                <p><strong>Nama:</strong> ${order.userName}</p>
                <p><strong>Layanan:</strong> ${order.layanan}</p>
                <p><strong>Total:</strong> ${order.total}</p>
                <p><strong>Status:</strong> ${order.status}</p>
            `;
            container.appendChild(div);
        });
    } catch (err) {
        container.innerHTML = "<p>Gagal memuat orders. Pastikan server backend berjalan.</p>";
        console.error(err);
    }
}

window.onload = loadOrders;
