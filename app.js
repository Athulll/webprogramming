let products = [];
let categories = [];
let activeCategory = 'all';
let searchQuery = '';
let sortBy = 'default';
let requestNumber = 0;
let searchTimer;
let isAuthenticated = false;
let csrfToken = null;
let totalItems = 0;
let bookings = [];

try {
  const savedBookings = JSON.parse(localStorage.getItem('shopcraft_bookings') || '[]');
  bookings = Array.isArray(savedBookings) ? savedBookings.map(String) : [];
} catch (error) {
  console.warn('Saved bookings could not be read:', error);
}

const categoryList = document.getElementById('category-list');
const productGrid = document.getElementById('product-grid');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const sortSelect = document.getElementById('sort-select');
const pageTitle = document.getElementById('page-title');
const itemCount = document.getElementById('item-count');
const noResults = document.getElementById('no-results');
const resetFilterBtn = document.getElementById('reset-filter-btn');
const brandLink = document.getElementById('brand-link');
const bookedCountEl = document.getElementById('booked-count');
const toastEl = document.getElementById('toast');
const dataStatus = document.getElementById('data-status');
const dataStatusMessage = document.getElementById('data-status-message');
const retryLoadBtn = document.getElementById('retry-load-btn');
const loginForm = document.getElementById('login-form');
const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const adminActions = document.getElementById('admin-actions');
const adminName = document.getElementById('admin-name');
const authMessage = document.getElementById('auth-message');
const itemFormPanel = document.getElementById('item-form-panel');
const itemForm = document.getElementById('item-form');
const itemFormTitle = document.getElementById('item-form-title');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function formatPrice(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2200);
}

async function apiRequest(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (options.body) headers['Content-Type'] = 'application/json';
  const [apiRoute, queryString = ''] = path.replace(/^\/api\//, '').split('?');
  const params = new URLSearchParams(queryString);
  params.set('route', apiRoute);
  const response = await fetch(`api/index.php?${params.toString()}`, {
    ...options,
    headers,
    credentials: 'same-origin'
  });
  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error(`The server returned an invalid response (${response.status}).`);
  }
  if (!response.ok) {
    if (response.status === 401 && isAuthenticated) setAuthenticated(false);
    throw new Error(payload.error || `Request failed (${response.status}).`);
  }
  return payload;
}

function setAuthenticated(authenticated, token = null) {
  isAuthenticated = authenticated;
  csrfToken = authenticated ? token : null;
  loginForm.hidden = authenticated;
  adminActions.hidden = !authenticated;
  renderProducts();
}

async function loadSession() {
  try {
    const session = await apiRequest('/api/session');
    setAuthenticated(session.authenticated, session.csrf_token);
    adminName.textContent = session.username || '';
  } catch (error) {
    console.error('Could not check the login session:', error);
    authMessage.textContent = 'Sign-in status could not be checked. You can still browse the catalog.';
  }
}

async function loadStoreData({ showLoading = false } = {}) {
  const currentRequest = ++requestNumber;
  const params = new URLSearchParams();
  if (searchQuery.trim()) params.set('q', searchQuery.trim());
  if (activeCategory !== 'all') params.set('category_id', activeCategory);
  const queryString = params.toString();

  if (showLoading || products.length === 0) {
    dataStatus.hidden = false;
    dataStatus.classList.remove('error');
    dataStatusMessage.textContent = 'Loading products...';
    retryLoadBtn.hidden = true;
    productGrid.style.display = 'none';
    noResults.style.display = 'none';
  }

  try {
    const data = await apiRequest(`/api/items${queryString ? `?${queryString}` : ''}`);
    if (currentRequest !== requestNumber) return;
    if (!Array.isArray(data.items) || !Array.isArray(data.categories)) {
      throw new Error('The server returned catalog data in an unsupported format.');
    }

    products = data.items;
    categories = data.categories;
    totalItems = Number(data.total_items) || products.length;
    renderCategories();
    renderProducts();
    updateBookingsCount();
    dataStatus.hidden = true;
  } catch (error) {
    if (currentRequest !== requestNumber) return;
    console.error('Could not load catalog items:', error);
    dataStatus.hidden = false;
    dataStatus.classList.add('error');
    dataStatusMessage.textContent = 'Catalog items could not be loaded. Check the PHP/MySQL server and try again.';
    retryLoadBtn.hidden = false;
    itemCount.textContent = 'Unavailable';
  }
}

function renderCategories() {
  const allCount = totalItems;
  const buttons = [
    `<button class="cat-btn ${activeCategory === 'all' ? 'active' : ''}" data-cat="all">All (${allCount})</button>`,
    ...categories.map(category => {
      const activeClass = String(category.id) === activeCategory ? 'active' : '';
      return `<button class="cat-btn ${activeClass}" data-cat="${escapeHtml(category.id)}">${escapeHtml(category.name)} (${escapeHtml(category.item_count)})</button>`;
    })
  ];
  categoryList.innerHTML = buttons.join('');
}

function getSortedProducts() {
  const sorted = [...products];
  if (sortBy === 'price-asc') sorted.sort((a, b) => Number(a.price) - Number(b.price));
  if (sortBy === 'price-desc') sorted.sort((a, b) => Number(b.price) - Number(a.price));
  if (sortBy === 'name-asc') sorted.sort((a, b) => a.name.localeCompare(b.name));
  return sorted;
}

function renderProducts() {
  const filtered = getSortedProducts();
  const category = categories.find(item => String(item.id) === activeCategory);
  pageTitle.textContent = activeCategory === 'all'
    ? (searchQuery ? `Search: "${searchQuery}"` : 'All Products')
    : (searchQuery ? `${category?.name || 'Category'} — "${searchQuery}"` : (category?.name || 'Category'));
  itemCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'item' : 'items'}`;

  if (filtered.length === 0) {
    productGrid.style.display = 'none';
    noResults.style.display = 'block';
    return;
  }

  productGrid.style.display = 'grid';
  noResults.style.display = 'none';
  productGrid.innerHTML = filtered.map(product => {
    const id = String(product.id);
    const isBooked = bookings.includes(id);
    const availableStock = Math.max(0, Number(product.stock) - (isBooked ? 1 : 0));
    const isOutOfStock = availableStock <= 0 && !isBooked;
    let stockClass = 'in-stock';
    let stockText = `${availableStock} available`;
    let actionButton;

    if (isBooked) {
      stockClass = 'booked';
      stockText = '✓ Booked by you';
      actionButton = `<button class="btn-cancel" data-cancel-id="${escapeHtml(id)}">Cancel Booking</button>`;
    } else if (isOutOfStock) {
      stockClass = 'out-stock';
      stockText = 'Out of stock';
      actionButton = '<button class="btn-buy" disabled>Sold Out</button>';
    } else {
      if (availableStock < 5) {
        stockClass = 'low-stock';
        stockText = `Only ${availableStock} left`;
      }
      actionButton = `<button class="btn-buy" data-buy-id="${escapeHtml(id)}">Buy Now</button>`;
    }

    const image = product.image_url
      ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" class="product-image" loading="lazy">`
      : '';
    const editButton = isAuthenticated
      ? `<button class="btn-edit" data-edit-id="${escapeHtml(id)}" type="button">Edit</button>`
      : '';

    return `
      <article class="product-card" data-id="${escapeHtml(id)}">
        <div class="product-image-wrap">${image}</div>
        <div class="product-info">
          <div class="product-meta">
            <span class="product-category">${escapeHtml(product.category_name)}</span>
            <span class="stock-tag ${stockClass}">${escapeHtml(stockText)}</span>
          </div>
          <h2 class="product-name">${escapeHtml(product.name)}</h2>
          <p class="product-desc">${escapeHtml(product.description)}</p>
          <div class="product-footer">
            <span class="product-price">${formatPrice(product.price)}</span>
            <div class="product-actions">${actionButton}${editButton}</div>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function updateBookingsCount() {
  bookedCountEl.textContent = bookings.length;
}

function handleBuy(productId) {
  const product = products.find(item => String(item.id) === productId);
  if (!product || Number(product.stock) - (bookings.includes(productId) ? 1 : 0) <= 0) return;
  if (!bookings.includes(productId)) {
    bookings.push(productId);
    localStorage.setItem('shopcraft_bookings', JSON.stringify(bookings));
    renderProducts();
    updateBookingsCount();
    showToast(`Purchased "${product.name}"!`);
  }
}

function handleCancelBooking(productId) {
  const product = products.find(item => String(item.id) === productId);
  if (!product) return;
  bookings = bookings.filter(id => id !== productId);
  localStorage.setItem('shopcraft_bookings', JSON.stringify(bookings));
  renderProducts();
  updateBookingsCount();
  showToast(`Cancelled booking for "${product.name}".`);
}

function resetItemForm() {
  itemForm.reset();
  document.getElementById('item-id').value = '';
  itemFormTitle.textContent = 'Add catalog item';
  itemFormPanel.hidden = true;
}

function openItemForm(product = null) {
  itemForm.reset();
  const categorySelect = document.getElementById('item-category');
  categorySelect.innerHTML = categories.map(category =>
    `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`
  ).join('');

  if (product) {
    document.getElementById('item-id').value = product.id;
    document.getElementById('item-name').value = product.name;
    document.getElementById('item-category').value = product.category_id;
    document.getElementById('item-price').value = product.price;
    document.getElementById('item-stock').value = product.stock;
    document.getElementById('item-description').value = product.description;
    document.getElementById('item-image').value = product.image_url || '';
    itemFormTitle.textContent = 'Update catalog item';
  } else {
    itemFormTitle.textContent = 'Add catalog item';
  }
  itemFormPanel.hidden = false;
  itemFormPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function submitLogin(event) {
  event.preventDefault();
  authMessage.textContent = '';
  authMessage.classList.remove('error');
  try {
    const session = await apiRequest('/api/login', {
      method: 'POST',
      body: JSON.stringify({
        username: loginUsername.value.trim(),
        password: loginPassword.value
      })
    });
    setAuthenticated(true, session.csrf_token);
    adminName.textContent = loginUsername.value.trim();
    loginPassword.value = '';
    showToast('Signed in. You can now add or update items.');
  } catch (error) {
    authMessage.textContent = error.message;
  }
}

async function saveItem(event) {
  event.preventDefault();
  const id = document.getElementById('item-id').value;
  const item = {
    name: document.getElementById('item-name').value.trim(),
    category_id: Number(document.getElementById('item-category').value),
    price: Number(document.getElementById('item-price').value),
    stock: Number(document.getElementById('item-stock').value),
    description: document.getElementById('item-description').value.trim(),
    image_url: document.getElementById('item-image').value.trim()
  };
  const saveButton = document.getElementById('save-item-btn');
  saveButton.disabled = true;

  try {
    const response = await apiRequest(id ? `/api/items/${encodeURIComponent(id)}` : '/api/items', {
      method: id ? 'PUT' : 'POST',
      headers: { 'X-CSRF-Token': csrfToken || '' },
      body: JSON.stringify(item)
    });
    resetItemForm();
    await loadStoreData();
    authMessage.textContent = '';
    authMessage.classList.remove('error');
    showToast(id ? 'Item updated.' : `Added "${response.item.name}".`);
  } catch (error) {
    authMessage.textContent = error.message;
    authMessage.classList.add('error');
  } finally {
    saveButton.disabled = false;
  }
}

async function signOut() {
  try {
    await apiRequest('/api/logout', {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken || '' }
    });
    setAuthenticated(false);
    adminName.textContent = '';
    resetItemForm();
    authMessage.textContent = '';
    authMessage.classList.remove('error');
    showToast('Signed out.');
  } catch (error) {
    authMessage.textContent = error.message;
    authMessage.classList.add('error');
  }
}

function setupListeners() {
  retryLoadBtn.addEventListener('click', () => loadStoreData({ showLoading: true }));
  loginForm.addEventListener('submit', submitLogin);
  itemForm.addEventListener('submit', saveItem);
  document.getElementById('new-item-btn').addEventListener('click', () => openItemForm());
  document.getElementById('logout-btn').addEventListener('click', signOut);
  document.getElementById('cancel-item-btn').addEventListener('click', resetItemForm);

  searchInput.addEventListener('input', event => {
    searchQuery = event.target.value;
    clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadStoreData(), 250);
  });

  clearSearchBtn.addEventListener('click', () => {
    searchQuery = '';
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    searchInput.focus();
    loadStoreData({ showLoading: true });
  });

  sortSelect.addEventListener('change', event => {
    sortBy = event.target.value;
    renderProducts();
  });

  resetFilterBtn.addEventListener('click', () => {
    activeCategory = 'all';
    searchQuery = '';
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    loadStoreData({ showLoading: true });
  });

  brandLink.addEventListener('click', event => {
    event.preventDefault();
    activeCategory = 'all';
    searchQuery = '';
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    loadStoreData({ showLoading: true });
  });

  categoryList.addEventListener('click', event => {
    const button = event.target.closest('[data-cat]');
    if (!button) return;
    activeCategory = button.getAttribute('data-cat');
    loadStoreData({ showLoading: true });
  });

  productGrid.addEventListener('click', event => {
    const buyButton = event.target.closest('[data-buy-id]');
    if (buyButton) return handleBuy(buyButton.getAttribute('data-buy-id'));
    const cancelButton = event.target.closest('[data-cancel-id]');
    if (cancelButton) return handleCancelBooking(cancelButton.getAttribute('data-cancel-id'));
    const editButton = event.target.closest('[data-edit-id]');
    if (editButton && isAuthenticated) {
      const product = products.find(item => String(item.id) === editButton.getAttribute('data-edit-id'));
      if (product) openItemForm(product);
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  setupListeners();
  await Promise.all([loadSession(), loadStoreData({ showLoading: true })]);
});
