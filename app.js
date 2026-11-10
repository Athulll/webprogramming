let products = [];
let categories = [];
let categoryMap = {};

let activeCategory = 'all';
let searchQuery = '';
let sortBy = 'default';

let bookings = JSON.parse(localStorage.getItem('shopcraft_bookings') || '[]');

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

function formatPrice(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN');
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => {
    toastEl.classList.remove('show');
  }, 2200);
}

async function loadStoreData() {
  dataStatus.hidden = false;
  dataStatus.classList.remove('error');
  dataStatusMessage.textContent = 'Loading products...';
  retryLoadBtn.hidden = true;
  productGrid.style.display = 'none';
  noResults.style.display = 'none';

  try {
    const response = await fetch('api.php', {
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`The server returned ${response.status}.`);
    }

    const data = await response.json();

    if (!data.graph || !Array.isArray(data.graph)) {
      throw new Error('Invalid graph structure');
    }

    const categoriesInData = data.graph.filter(item => item.type === 'Category');
    const productsInData = data.graph.filter(item => item.type === 'Product');
    if (
      categoriesInData.length + productsInData.length !== data.graph.length ||
      categoriesInData.some(item => !item.id || !item.name) ||
      productsInData.some(item => !item.id || !item.name || !item.category || !Number.isFinite(item.price))
    ) {
      throw new Error('The server returned data in an unsupported format.');
    }

    products = [];
    categories = [];
    categoryMap = {};

    data.graph.forEach(item => {
      if (item.type === 'Category') {
        categories.push(item);
        categoryMap[item.id] = item.name;
      } else if (item.type === 'Product') {
        const isBooked = bookings.includes(item.id);
        const currentStock = isBooked ? Math.max(0, item.stock - 1) : item.stock;
        products.push({ ...item, stock: currentStock });
      }
    });

    renderCategories();
    renderProducts();
    updateBookingsCount();
    dataStatus.hidden = true;
  } catch (error) {
    console.error('Error loading products from api.php:', error);
    dataStatus.hidden = false;
    dataStatus.classList.add('error');
    dataStatusMessage.textContent = 'Products could not be loaded. Check your connection and try again.';
    retryLoadBtn.hidden = false;
  }
}

function renderCategories() {
  const allBtn = `
    <button class="cat-btn ${activeCategory === 'all' ? 'active' : ''}" data-cat="all">
      All (${products.length})
    </button>
  `;

  const categoryButtons = categories.map(cat => {
    const count = products.filter(p => p.category === cat.id).length;
    const isActive = activeCategory === cat.id ? 'active' : '';
    return `
      <button class="cat-btn ${isActive}" data-cat="${cat.id}">
        ${cat.name} (${count})
      </button>
    `;
  }).join('');

  categoryList.innerHTML = allBtn + categoryButtons;

  categoryList.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.getAttribute('data-cat');
      renderCategories();
      renderProducts();
    });
  });
}

function getFilteredProducts() {
  let filtered = [...products];

  if (activeCategory !== 'all') {
    filtered = filtered.filter(p => p.category === activeCategory);
  }

  if (searchQuery.trim() !== '') {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(p => {
      const nameMatch = p.name.toLowerCase().includes(q);
      const descMatch = (p.description || '').toLowerCase().includes(q);
      return nameMatch || descMatch;
    });
  }

  if (sortBy === 'price-asc') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (sortBy === 'price-desc') {
    filtered.sort((a, b) => b.price - a.price);
  } else if (sortBy === 'name-asc') {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  return filtered;
}

function renderProducts() {
  const filtered = getFilteredProducts();

  if (activeCategory === 'all') {
    pageTitle.textContent = searchQuery ? `Search: "${searchQuery}"` : 'All Products';
  } else {
    const catName = categoryMap[activeCategory] || 'Category';
    pageTitle.textContent = searchQuery ? `${catName} — "${searchQuery}"` : catName;
  }
  itemCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'item' : 'items'}`;

  if (filtered.length === 0) {
    productGrid.style.display = 'none';
    noResults.style.display = 'block';
    return;
  }

  productGrid.style.display = 'grid';
  noResults.style.display = 'none';

  productGrid.innerHTML = filtered.map(product => {
    const categoryName = categoryMap[product.category] || 'General';
    const isBooked = bookings.includes(product.id);
    const isOutOfStock = product.stock <= 0 && !isBooked;

    let stockClass = 'in-stock';
    let stockText = `${product.stock} available`;
    let actionBtnHTML = '';

    if (isBooked) {
      stockClass = 'booked';
      stockText = '✓ Booked by you';
      actionBtnHTML = `
        <button class="btn-cancel" data-cancel-id="${product.id}">
          Cancel Booking
        </button>
      `;
    } else if (isOutOfStock) {
      stockClass = 'out-stock';
      stockText = 'Out of stock';
      actionBtnHTML = `
        <button class="btn-buy" disabled>
          Sold Out
        </button>
      `;
    } else {
      if (product.stock < 5) {
        stockClass = 'low-stock';
        stockText = `Only ${product.stock} left`;
      }
      actionBtnHTML = `
        <button class="btn-buy" data-buy-id="${product.id}">
          Buy Now
        </button>
      `;
    }

    return `
      <article class="product-card" data-id="${product.id}">
        <div class="product-image-wrap">
          <img 
            src="${product.image}" 
            alt="${product.name}" 
            class="product-image"
            loading="lazy"
            onerror="this.src='https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=600&auto=format&fit=crop&q=80'"
          >
        </div>
        <div class="product-info">
          <div class="product-meta">
            <span class="product-category">${categoryName}</span>
            <span class="stock-tag ${stockClass}">${stockText}</span>
          </div>

          <h2 class="product-name">${product.name}</h2>
          <p class="product-desc">${product.description || ''}</p>

          <div class="product-footer">
            <span class="product-price">${formatPrice(product.price)}</span>
            ${actionBtnHTML}
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function updateBookingsCount() {
  if (bookedCountEl) {
    bookedCountEl.textContent = bookings.length;
  }
}

function handleBuy(productId) {
  const product = products.find(p => p.id === productId);
  if (!product || product.stock <= 0) return;

  if (!bookings.includes(productId)) {
    bookings.push(productId);
    product.stock -= 1;
    localStorage.setItem('shopcraft_bookings', JSON.stringify(bookings));
    renderProducts();
    updateBookingsCount();
    showToast(`Purchased "${product.name}"!`);
  }
}

function handleCancelBooking(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  bookings = bookings.filter(id => id !== productId);
  product.stock += 1;
  localStorage.setItem('shopcraft_bookings', JSON.stringify(bookings));
  renderProducts();
  updateBookingsCount();
  showToast(`Cancelled booking for "${product.name}".`);
}

function setupListeners() {
  retryLoadBtn.addEventListener('click', loadStoreData);

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
    renderProducts();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchQuery = '';
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    searchInput.focus();
    renderProducts();
  });

  sortSelect.addEventListener('change', (e) => {
    sortBy = e.target.value;
    renderProducts();
  });

  resetFilterBtn.addEventListener('click', () => {
    activeCategory = 'all';
    searchQuery = '';
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    renderCategories();
    renderProducts();
  });

  brandLink.addEventListener('click', (e) => {
    e.preventDefault();
    activeCategory = 'all';
    searchQuery = '';
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    renderCategories();
    renderProducts();
  });

  productGrid.addEventListener('click', (e) => {
    const buyBtn = e.target.closest('[data-buy-id]');
    if (buyBtn) {
      const prodId = buyBtn.getAttribute('data-buy-id');
      handleBuy(prodId);
      return;
    }

    const cancelBtn = e.target.closest('[data-cancel-id]');
    if (cancelBtn) {
      const prodId = cancelBtn.getAttribute('data-cancel-id');
      handleCancelBooking(prodId);
      return;
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupListeners();
  loadStoreData();
});
