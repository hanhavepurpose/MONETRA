
const $ = (selector) => document.querySelector(selector);

const STORAGE_KEYS = {
  transactions: "monetra_transactions_v1",
  savings: "monetra_savings_v1"
};

let transactions = loadData(STORAGE_KEYS.transactions, []);
let savings = loadData(STORAGE_KEYS.savings, null);
let editingId = null;

if (!Array.isArray(transactions)) transactions = [];

function loadData(key, fallback) {
  try {
    const data = localStorage.getItem(key);
    return data === null ? fallback : JSON.parse(data);
  } catch (error) {
    console.error("Gagal membaca data:", error);
    return fallback;
  }
}

function saveTransactions() {
  try {
    localStorage.setItem(
      STORAGE_KEYS.transactions,
      JSON.stringify(transactions)
    );
    return true;
  } catch (error) {
    console.error(error);
    showMessage("Penyimpanan gagal. Periksa ruang penyimpanan.", true);
    return false;
  }
}

function saveSavings() {
  try {
    localStorage.setItem(STORAGE_KEYS.savings, JSON.stringify(savings));
    return true;
  } catch (error) {
    console.error(error);
    showMessage("Target gagal disimpan.", true);
    return false;
  }
}

function rupiah(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(amount);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function todayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatDate(value) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function showMessage(message, isError = false) {
  const element = $("#formMessage");
  if (!element) return;

  element.textContent = message;
  element.style.color = isError ? "#ff8282" : "#69e69a";
}

function getTotals(list) {
  return list.reduce((result, item) => {
    if (item.type === "income") {
      result.income += item.amount;
    } else {
      result.expense += item.amount;
    }

    return result;
  }, { income: 0, expense: 0 });
}

/* =========================
   FILTER BULAN DAN TAHUN
========================= */

function setupPeriodFilters() {
  const filterRow = $("#searchInput")?.parentElement;
  if (!filterRow || $("#filterMonth")) return;

  const monthSelect = document.createElement("select");
  monthSelect.id = "filterMonth";
  monthSelect.setAttribute("aria-label", "Filter bulan");

  const months = [
    "Januari", "Februari", "Maret", "April",
    "Mei", "Juni", "Juli", "Agustus",
    "September", "Oktober", "November", "Desember"
  ];

  monthSelect.innerHTML =
    '<option value="all">Semua bulan</option>' +
    months.map((month, index) =>
      `<option value="${String(index + 1).padStart(2, "0")}">${month}</option>`
    ).join("");

  const yearSelect = document.createElement("select");
  yearSelect.id = "filterYear";
  yearSelect.setAttribute("aria-label", "Filter tahun");

  filterRow.append(monthSelect, yearSelect);

  const currentMonth = String(new Date().getMonth() + 1).padStart(2, "0");
  monthSelect.value = currentMonth;

  monthSelect.addEventListener("change", renderTransactions);
  yearSelect.addEventListener("change", renderTransactions);

  updateYearOptions();
}

function updateYearOptions() {
  const select = $("#filterYear");
  if (!select) return;

  const currentValue = select.value;
  const years = new Set([
    String(new Date().getFullYear()),
    ...transactions.map(item => item.date.slice(0, 4))
  ]);

  select.innerHTML =
    '<option value="all">Semua tahun</option>' +
    [...years].filter(year => /^\d{4}$/.test(year))
      .sort((a, b) => Number(b) - Number(a))
      .map(year => `<option value="${year}">${year}</option>`)
      .join("");

  if ([...select.options].some(option => option.value === currentValue)) {
    select.value = currentValue;
  }
}

/* =========================
   DASHBOARD
========================= */

function renderDashboard() {
  const totals = getTotals(transactions);
  const prefix = todayString().slice(0, 7);

  const monthly = getTotals(
    transactions.filter(item => item.date.startsWith(prefix))
  );

  $("#totalBalance").textContent =
    rupiah(totals.income - totals.expense);

  $("#totalIncome").textContent = rupiah(monthly.income);
  $("#totalExpense").textContent = rupiah(monthly.expense);

  $("#todayLabel").textContent = new Date().toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

/* =========================
   FORM EDIT TRANSAKSI
========================= */

function setupEditControls() {
  const submitButton = $("#transactionForm button[type='submit']");
  if (!submitButton || $("#cancelEdit")) return;

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.id = "cancelEdit";
  cancelButton.className = "secondary-button";
  cancelButton.textContent = "Batal edit";
  cancelButton.hidden = true;
  cancelButton.style.marginTop = "10px";

  submitButton.insertAdjacentElement("afterend", cancelButton);
  cancelButton.addEventListener("click", cancelEdit);
}

function startEdit(id) {
  const item = transactions.find(transaction => transaction.id === id);
  if (!item) return;

  editingId = id;

  $("#description").value = item.description;
  $("#type").value = item.type;
  $("#amount").value = item.amount;
  $("#category").value = item.category;
  $("#date").value = item.date;

  const submitButton = $("#transactionForm button[type='submit']");
  submitButton.innerHTML = "Simpan perubahan";

  $("#cancelEdit").hidden = false;
  showMessage("Mode edit aktif. Ubah data lalu simpan.");

  $("#transactionForm").scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  $("#description").focus();
}

function cancelEdit() {
  editingId = null;

  $("#transactionForm").reset();
  $("#date").value = todayString();

  $("#transactionForm button[type='submit']").innerHTML =
    "<span>＋</span> Simpan transaksi";

  $("#cancelEdit").hidden = true;
  showMessage("Edit dibatalkan.");
}

function renderTransactions() {
  const query = $("#searchInput").value.trim().toLowerCase();
  const type = $("#filterType").value;
  const month = $("#filterMonth")?.value ?? "all";
  const year = $("#filterYear")?.value ?? "all";

  const filtered = [...transactions]
    .filter(item => type === "all" || item.type === type)
    .filter(item => month === "all" || item.date.slice(5, 7) === month)
    .filter(item => year === "all" || item.date.slice(0, 4) === year)
    .filter(item =>
      item.description.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query)
    )
    .sort((a, b) =>
      b.date.localeCompare(a.date) || b.createdAt - a.createdAt
    );

  $("#transactionCount").textContent =
    `${filtered.length} dari ${transactions.length} transaksi`;

  const list = $("#transactionList");

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        Belum ada transaksi yang cocok dengan filter lu.
      </div>`;
    return;
  }

  list.innerHTML = filtered.map(item => {
    const income = item.type === "income";

    return `
      <div class="transaction-item">
        <div class="transaction-symbol ${income ? "" : "expense"}">
          ${income ? "↙" : "↗"}
        </div>

        <div class="transaction-info">
          <div class="transaction-name">
            ${escapeHTML(item.description)}
          </div>
          <div class="transaction-meta">
            ${escapeHTML(item.category)} · ${formatDate(item.date)}
          </div>
        </div>

        <div class="transaction-amount ${item.type}">
          ${income ? "+" : "−"}${rupiah(item.amount)}
        </div>

        <button
          class="secondary-button"
          type="button"
          data-edit="${escapeHTML(item.id)}"
          aria-label="Edit ${escapeHTML(item.description)}">
          Edit
        </button>

        <button
          class="delete-button"
          type="button"
          data-delete="${escapeHTML(item.id)}"
          aria-label="Hapus ${escapeHTML(item.description)}"
          title="Hapus transaksi">×</button>
      </div>`;
  }).join("");
}

/* =========================
   GRAFIK ARUS KAS 6 BULAN
========================= */

function renderChart() {
  const container = $("#monthlyChart");
  const now = new Date();
  const months = [];

  for (let offset = 5; offset >= 0; offset--) {
    months.push(new Date(now.getFullYear(), now.getMonth() - offset, 1));
  }

  const data = months.map(date => {
    const prefix =
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    const totals = getTotals(
      transactions.filter(item => item.date.startsWith(prefix))
    );

    return {
      label: date.toLocaleDateString("id-ID", { month: "short" }),
      ...totals
    };
  });

  const maxValue = Math.max(
    1,
    ...data.flatMap(item => [item.income, item.expense])
  );

  container.innerHTML = data.map(item => {
    const incomeHeight = item.income === 0
      ? 3 : Math.max(5, item.income / maxValue * 145);

    const expenseHeight = item.expense === 0
      ? 3 : Math.max(5, item.expense / maxValue * 145);

    return `
      <div class="chart-column">
        <div class="bar-pair">
          <div class="bar income"
            style="height:${incomeHeight}px"
            title="Masuk: ${rupiah(item.income)}"></div>
          <div class="bar expense"
            style="height:${expenseHeight}px"
            title="Keluar: ${rupiah(item.expense)}"></div>
        </div>
        <span class="chart-month">${item.label}</span>
      </div>`;
  }).join("");
}

/* =========================
   ANALISIS PER KATEGORI
========================= */

function setupCategoryChart() {
  const panel = $("#analytics");
  if (!panel || $("#categoryChart")) return;

  const section = document.createElement("div");
  section.className = "category-analysis";
  section.innerHTML = `
    <div class="section-heading" style="margin-top:24px">
      <div>
        <p class="eyebrow">ANALISIS PENGELUARAN</p>
        <h2>Pengeluaran per kategori</h2>
      </div>
    </div>
    <div id="categoryChart"></div>
  `;

  panel.appendChild(section);
}

function renderCategoryChart() {
  const container = $("#categoryChart");
  if (!container) return;

  const totals = {};

  transactions
    .filter(item => item.type === "expense")
    .forEach(item => {
      totals[item.category] = (totals[item.category] || 0) + item.amount;
    });

  const categories = Object.entries(totals)
    .sort((a, b) => b[1] - a[1]);

  if (categories.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        Belum ada data pengeluaran untuk dianalisis.
      </div>`;
    return;
  }

  const maxValue = Math.max(...categories.map(item => item[1]));

  container.innerHTML = categories.map(([name, amount]) => {
    const width = amount / maxValue * 100;

    return `
      <div style="margin:16px 0">
        <div style="
          display:flex;
          justify-content:space-between;
          gap:12px;
          margin-bottom:7px;
          font-size:13px">
          <span>${escapeHTML(name)}</span>
          <strong>${rupiah(amount)}</strong>
        </div>

        <div style="
          height:9px;
          background:#26312a;
          border-radius:99px;
          overflow:hidden">
          <div style="
            height:100%;
            width:${width}%;
            background:#69e69a;
            border-radius:99px"></div>
        </div>
      </div>`;
  }).join("");
}

/* =========================
   TARGET TABUNGAN
========================= */

function renderSavings() {
  const container = $("#savingsDisplay");

  if (!savings) {
    container.innerHTML = `
      <div class="empty-state">
        Belum ada target tabungan.<br>
        Buat target pertama lu di atas!
      </div>`;
    return;
  }

  const percent = Math.min(100, savings.saved / savings.target * 100);
  const remaining = Math.max(0, savings.target - savings.saved);

  container.innerHTML = `
    <div class="savings-result">
      <div class="savings-result-top">
        <div>
          <h3>${escapeHTML(savings.name)}</h3>
          <p>${rupiah(savings.saved)} terkumpul dari ${rupiah(savings.target)}</p>
        </div>
        <span class="savings-percent">${percent.toFixed(1)}%</span>
      </div>

      <div class="progress-track"
        role="progressbar"
        aria-valuenow="${percent.toFixed(1)}"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="Progres target tabungan">
        <div class="progress-fill" style="width:${percent}%"></div>
      </div>

      <p style="margin-top:12px">
        ${remaining === 0
          ? "Target tercapai! Mantap, bro! 🎉"
          : `Kurang ${rupiah(remaining)} lagi untuk mencapai target.`}
      </p>
    </div>`;
}

/* =========================
   RENDER SEMUA
========================= */

function renderAll() {
  updateYearOptions();
  renderDashboard();
  renderTransactions();
  renderChart();
  renderCategoryChart();
  renderSavings();
}

/* =========================
   TAMBAH DAN EDIT TRANSAKSI
========================= */

$("#date").value = todayString();

$("#transactionForm").addEventListener("submit", event => {
  event.preventDefault();

  const description = $("#description").value.trim();
  const type = $("#type").value;
  const amount = Number($("#amount").value);
  const category = $("#category").value;
  const date = $("#date").value;

  if (
    !description ||
    !date ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    !["income", "expense"].includes(type)
  ) {
    showMessage("Isi semua detail transaksi dengan benar.", true);
    return;
  }

  const previous = [...transactions];

  if (editingId) {
    transactions = transactions.map(item =>
      item.id === editingId
        ? { ...item, description, type, amount, category, date }
        : item
    );
  } else {
    transactions.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      description,
      type,
      amount,
      category,
      date,
      createdAt: Date.now()
    });
  }

  if (!saveTransactions()) {
    transactions = previous;
    return;
  }

  const wasEditing = Boolean(editingId);
  editingId = null;

  $("#transactionForm").reset();
  $("#date").value = todayString();
  $("#transactionForm button[type='submit']").innerHTML =
    "<span>＋</span> Simpan transaksi";
  $("#cancelEdit").hidden = true;

  showMessage(
    wasEditing
      ? "Perubahan transaksi berhasil disimpan!"
      : "Transaksi berhasil disimpan!"
  );

  renderAll();
});

/* =========================
   TOMBOL EDIT DAN HAPUS
========================= */

$("#transactionList").addEventListener("click", event => {
  const editButton = event.target.closest("[data-edit]");

  if (editButton) {
    startEdit(editButton.dataset.edit);
    return;
  }

  const deleteButton = event.target.closest("[data-delete]");
  if (!deleteButton) return;

  const id = deleteButton.dataset.delete;
  const item = transactions.find(transaction => transaction.id === id);
  if (!item) return;

  if (!confirm(`Hapus transaksi "${item.description}"?`)) return;

  const previous = transactions;
  transactions = transactions.filter(transaction => transaction.id !== id);

  if (!saveTransactions()) {
    transactions = previous;
    return;
  }

  if (editingId === id) cancelEdit();

  showMessage("Transaksi berhasil dihapus.");
  renderAll();
});

$("#searchInput").addEventListener("input", renderTransactions);
$("#filterType").addEventListener("change", renderTransactions);

/* =========================
   SIMPAN TARGET TABUNGAN
========================= */

$("#savingsForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = $("#goalName").value.trim();
  const target = Number($("#goalAmount").value);
  const saved = Number($("#savedAmount").value);

  if (
    !name ||
    !Number.isSafeInteger(target) ||
    !Number.isSafeInteger(saved) ||
    target <= 0 ||
    saved < 0
  ) {
    alert("Masukkan nama dan nominal target yang valid.");
    return;
  }

  const previous = savings;
  savings = { name, target, saved };

  if (!saveSavings()) {
    savings = previous;
    return;
  }

  renderSavings();
});

/* =========================
   BACKUP DAN RESTORE JSON
========================= */

$("#exportData").addEventListener("click", () => {
  const backup = {
    app: "Monetra",
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions,
    savings
  };

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `monetra-backup-${todayString()}.json`;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);

  $("#backupMessage").textContent =
    "Backup berhasil dibuat. Simpan file JSON dengan aman.";
});

$("#importFile").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const data = JSON.parse(await file.text());

    if (
      data.app !== "Monetra" ||
      data.version !== 1 ||
      !Array.isArray(data.transactions)
    ) {
      throw new Error("Format backup tidak sesuai.");
    }

    const validTransactions = data.transactions.every(item =>
      item &&
      typeof item.id === "string" &&
      typeof item.description === "string" &&
      ["income", "expense"].includes(item.type) &&
      Number.isSafeInteger(item.amount) &&
      item.amount > 0 &&
      typeof item.category === "string" &&
      typeof item.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
      Number.isFinite(item.createdAt)
    );

    const validSavings = data.savings === null ||
      (
        data.savings &&
        typeof data.savings.name === "string" &&
        Number.isSafeInteger(data.savings.target) &&
        data.savings.target > 0 &&
        Number.isSafeInteger(data.savings.saved) &&
        data.savings.saved >= 0
      );

    if (!validTransactions || !validSavings) {
      throw new Error("Ada data backup yang tidak valid.");
    }

    if (!confirm(
      "Impor akan mengganti semua transaksi dan target saat ini. Lanjutkan?"
    )) return;

    const oldTransactions = transactions;
    const oldSavings = savings;

    transactions = data.transactions;
    savings = data.savings;

    if (!saveTransactions() || !saveSavings()) {
      transactions = oldTransactions;
      savings = oldSavings;

      try {
        localStorage.setItem(
          STORAGE_KEYS.transactions,
          JSON.stringify(oldTransactions)
        );
        localStorage.setItem(
          STORAGE_KEYS.savings,
          JSON.stringify(oldSavings)
        );
      } catch (error) {
        console.error("Gagal memulihkan data sebelumnya:", error);
      }

      renderAll();
      throw new Error("Penyimpanan gagal. Data lama dipulihkan jika memungkinkan.");
    }

    if (savings) {
      $("#goalName").value = savings.name;
      $("#goalAmount").value = savings.target;
      $("#savedAmount").value = savings.saved;
    } else {
      $("#savingsForm").reset();
    }

    cancelEdit();
    renderAll();

    $("#backupMessage").textContent = "Backup berhasil diimpor!";
  } catch (error) {
    $("#backupMessage").textContent =
      "Gagal mengimpor: " + error.message;

    console.error("Kesalahan impor backup:", error);
  } finally {
    event.target.value = "";
  }
});

/* =========================
   MULAI APLIKASI
========================= */

if (savings) {
  $("#goalName").value = savings.name;
  $("#goalAmount").value = savings.target;
  $("#savedAmount").value = savings.saved;
}

setupPeriodFilters();
setupEditControls();
setupCategoryChart();
renderAll();
