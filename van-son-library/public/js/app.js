function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('vanson_user')) || null;
  } catch {
    localStorage.removeItem('vanson_user');
    localStorage.removeItem('vanson_token');
    return null;
  }
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function safeImageUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function wrapCoverTitle(title, maxLength = 20) {
  const lines = [];
  let line = '';

  String(title || 'Sách chưa đặt tên').trim().split(/\s+/).forEach((word) => {
    if (line && `${line} ${word}`.length > maxLength) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  });

  if (line) lines.push(line);
  return lines;
}

function createBookCover(book) {
  const palettes = [
    { background: '#1b4332', accent: '#e9c46a' },
    { background: '#5b3348', accent: '#f2b5a7' },
    { background: '#315a7d', accent: '#f4c27a' },
    { background: '#72512f', accent: '#e8d08c' },
    { background: '#51467a', accent: '#d9b4e8' },
    { background: '#1f6864', accent: '#f0b86e' }
  ];
  const key = String(book.id || book.title || '');
  const colorIndex = Array.from(key).reduce(
    (sum, character, index) => sum + character.codePointAt(0) * (index + 1),
    0
  ) % palettes.length;
  const palette = palettes[colorIndex];
  const title = wrapCoverTitle(book.title).map((line, index) =>
    `<tspan x="150" dy="${index === 0 ? 0 : 28}">${escapeHtml(line)}</tspan>`
  ).join('');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="420" viewBox="0 0 300 420">
      <defs>
        <linearGradient id="cover" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${palette.background}"/>
          <stop offset="1" stop-color="${palette.accent}"/>
        </linearGradient>
      </defs>
      <rect width="300" height="420" rx="12" fill="url(#cover)"/>
      <rect x="14" y="14" width="272" height="392" rx="8" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2"/>
      <text x="150" y="55" fill="#fff" font-family="Arial, sans-serif" font-size="13" font-weight="700" letter-spacing="2" text-anchor="middle">VĂN SƠN LIBRARY</text>
      <circle cx="150" cy="112" r="44" fill="${palette.accent}" fill-opacity=".3"/>
      <path d="M110 91c14-7 27-6 40 1v39c-13-7-26-8-40-2z" fill="#fff"/>
      <path d="M150 92c13-7 26-8 40-1v38c-14-6-27-5-40 2z" fill="#fefae0"/>
      <path d="M150 94v38" stroke="${palette.background}" stroke-width="3" opacity=".7"/>
      <text x="150" y="194" fill="#fff" font-family="Arial, sans-serif" font-size="21" font-weight="700" text-anchor="middle">${title}</text>
      <line x1="82" y1="326" x2="218" y2="326" stroke="#fff" stroke-opacity=".7"/>
      <text x="150" y="358" fill="#fff" font-family="Arial, sans-serif" font-size="15" text-anchor="middle">${escapeHtml(book.author || 'Văn Sơn Library')}</text>
      <text x="150" y="383" fill="#fff" fill-opacity=".8" font-family="Arial, sans-serif" font-size="11" text-anchor="middle">${escapeHtml(book.category || 'SÁCH')}</text>
    </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const ONLINE_BOOK_COVERS = [
  8762862, 23833967, 8045884, 32046500, 8200898, 29171841,
  7034613, 33352856, 16412993, 7054519, 8447618, 19027156,
  35098073, 34260873, 9572664, 17548877, 433333, 34876157,
  19227495, 7034050, 6266098, 1098656, 30312525, 1792734,
  3060324, 32368063, 3007370, 936133, 8500276, 1650207,
  7694143, 5896593, 2912515
];

function getOnlineBookCover(book) {
  const key = String(book.id || book.title || '');
  const hash = Array.from(key).reduce(
    (value, character) => (value * 31 + character.codePointAt(0)) >>> 0,
    0
  );
  const numericId = key.match(/\d+$/)?.[0];
  const coverIndex = numericId && Number(numericId) <= ONLINE_BOOK_COVERS.length
    ? Number(numericId) - 1
    : hash % ONLINE_BOOK_COVERS.length;
  const photoId = ONLINE_BOOK_COVERS[coverIndex];
  return `https://images.pexels.com/photos/${photoId}/pexels-photo-${photoId}.jpeg?auto=compress&cs=tinysrgb&w=800`;
}

function setBookCover(image, book) {
  const fallback = createBookCover(book);
  const imageUrl = safeImageUrl(book.image_url);
  const onlineImageUrl = getOnlineBookCover(book);
  let usingOnlineFallback = !imageUrl;
  image.classList.remove('book-cover-generated');
  const handleCoverError = () => {
    if (!usingOnlineFallback) {
      usingOnlineFallback = true;
      image.src = onlineImageUrl;
    } else {
      image.removeEventListener('error', handleCoverError);
      image.classList.add('book-cover-generated');
      image.src = fallback;
    }
  };
  image.addEventListener('error', handleCoverError);
  image.src = imageUrl || onlineImageUrl;
}

const DEFAULT_API_BASE = 'http://localhost:3000';

function resolveApiBase() {
  const origin = window.location.origin;
  return origin && origin !== 'null' ? origin : DEFAULT_API_BASE;
}

function apiUrl(path) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path, `${resolveApiBase()}/`).toString();
}

let currentUser = readStoredUser();
let currentToken = localStorage.getItem('vanson_token') || null;
let activeCategory = 'Tất cả';
const booksById = new Map();

// =================== TIỆN ÍCH CHUYỂN TAB & KHỞI CHẠY ===================
document.addEventListener('DOMContentLoaded', () => {
  renderAuthUI();
  document.getElementById('search-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearch();
    }
  });
  document.getElementById('books-grid').addEventListener('click', (event) => {
    const coverButton = event.target.closest('[data-book-details-id]');
    if (coverButton) {
      const book = booksById.get(coverButton.dataset.bookDetailsId);
      const image = coverButton.querySelector('img');
      if (book && image) openBookDetails(book, image.src);
      return;
    }

    const borrowButton = event.target.closest('[data-book-id]');
    if (!borrowButton) return;
    const book = booksById.get(borrowButton.dataset.bookId);
    if (book) openBorrowModal(book.id, book.title, book.shelf_location || 'Đang cập nhật');
  });
  document.getElementById('admin-books-table').addEventListener('click', (event) => {
    const button = event.target.closest('[data-delete-book]');
    if (button) deleteBook(button.dataset.deleteBook);
  });
  document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal(modal.id);
    });
  });
  fetchBooks();
});

function switchTab(tab) {
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.tab === tab);
  });
  document.getElementById('view-home').style.display = 'none';
  document.getElementById('view-loans').style.display = 'none';
  document.getElementById('view-admin').style.display = 'none';

  if (tab === 'home' || tab === 'catalog') {
    document.getElementById('view-home').style.display = 'block';
  } else if (tab === 'loans') {
    document.getElementById('view-loans').style.display = 'block';
    fetchMyLoans();
  } else if (tab === 'admin') {
    document.getElementById('view-admin').style.display = 'block';
    loadAdminDashboard().catch((error) => alert(error.message || 'Không thể tải trang quản trị.'));
  }
}

// =================== XỬ LÝ PHÂN QUYỀN GIAO DIỆN ===================
function renderAuthUI() {
  const container = document.getElementById('auth-actions');
  const navLoans = document.getElementById('nav-loans');
  const navAdmin = document.getElementById('nav-admin');

  if (currentUser) {
    navLoans.style.display = 'inline-block';
    navAdmin.style.display = currentUser.role === 'Admin' ? 'inline-block' : 'none';

    container.innerHTML = `
      <span style="font-size: 0.9rem; color: #fefae0;"><i class="fa-solid fa-circle-user"></i> ${escapeHtml(currentUser.name)} (${escapeHtml(currentUser.role)})</span>
      <button class="btn btn-outline" onclick="handleLogout()"><i class="fa-solid fa-right-from-bracket"></i> Đăng xuất</button>
    `;
  } else {
    navLoans.style.display = 'none';
    navAdmin.style.display = 'none';
    container.innerHTML = `
      <button class="btn btn-outline" onclick="openModal('modal-login')">Đăng nhập</button>
      <button class="btn btn-gold" onclick="openModal('modal-register')">Đăng ký</button>
    `;
  }
}

function handleLogout() {
  localStorage.removeItem('vanson_user');
  localStorage.removeItem('vanson_token');
  currentUser = null;
  currentToken = null;
  renderAuthUI();
  switchTab('home');
}

// =================== XỬ LÝ SÁCH & TÌM KIẾM ===================
async function fetchBooks(searchTerm = '') {
  let url = apiUrl(`/api/books?category=${encodeURIComponent(activeCategory)}`);
  if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;

  try {
    const res = await fetch(url);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('Không kết nối được máy chủ. Hãy chạy ứng dụng bằng lệnh npm start.');
    }
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || 'Không thể tải danh sách sách.');
    const books = result;
    if (!Array.isArray(books)) throw new Error('Dữ liệu sách trả về không hợp lệ.');
    renderBooksGrid(books);
  } catch (err) {
    const grid = document.getElementById('books-grid');
    grid.innerHTML = `<p class="empty-state" role="status">${escapeHtml(err.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.')}</p>`;
  }
}

function filterCategory(cat) {
  activeCategory = cat;
  document.querySelectorAll('.category-option').forEach((button) => {
    button.classList.toggle('active', button.dataset.category === cat);
  });
  document.getElementById('category-dropdown').open = false;
  fetchBooks(document.getElementById('search-input').value.trim());
}

function handleSearch() {
  const query = document.getElementById('search-input').value.trim();
  fetchBooks(query);
}

function renderBooksGrid(books) {
  const grid = document.getElementById('books-grid');
  booksById.clear();
  grid.innerHTML = '';

  if (books.length === 0) {
    grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); font-size: 1.1rem;">Không tìm thấy cuốn sách nào phù hợp!</p>`;
    return;
  }

  books.forEach(b => {
    booksById.set(String(b.id), b);
    let statusClass = 'status-available';
    let statusText = `Còn sách (${b.available_quantity}/${b.total_quantity})`;

    if (b.available_quantity === 0) {
      statusClass = 'status-out';
      statusText = 'Đã hết sách';
    } else if (b.available_quantity < b.total_quantity) {
      statusClass = 'status-partial';
      statusText = `Đang mượn 1 phần (còn ${b.available_quantity})`;
    }

    const card = document.createElement('article');
    card.className = 'book-card';
    card.innerHTML = `
      <div class="book-card-body">
        <span class="book-badge-id">MÃ: ${escapeHtml(b.id)} | ${escapeHtml(b.category)}</span>
        <h3 class="book-card-title">${escapeHtml(b.title)}</h3>
        <p class="book-card-author"><i class="fa-solid fa-pen-nib"></i> ${escapeHtml(b.author)}</p>
        <p class="book-location"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(b.shelf_location || 'Đang cập nhật')}</p>
        <span class="book-status ${statusClass}">${statusText}</span>
        <div class="book-card-footer">
          <button class="btn btn-primary btn-block" data-book-id="${escapeHtml(b.id)}" ${b.available_quantity === 0 ? 'disabled' : ''}>
            ${b.available_quantity === 0 ? 'Tạm hết sách' : '<i class="fa-solid fa-bookmark"></i> Đăng ký mượn'}
          </button>
        </div>
      </div>
    `;
    const coverImage = document.createElement('img');
    coverImage.alt = `Bìa sách ${b.title || ''}`;
    coverImage.className = 'book-card-image';
    coverImage.loading = 'lazy';
    setBookCover(coverImage, b);

    const coverButton = document.createElement('button');
    coverButton.type = 'button';
    coverButton.className = 'book-cover-button';
    coverButton.dataset.bookDetailsId = String(b.id);
    coverButton.setAttribute('aria-label', `Xem nội dung sách ${b.title || ''}`);
    coverButton.appendChild(coverImage);
    card.prepend(coverButton);
    grid.appendChild(card);
  });
}

// =================== MƯỢN SÁCH & LỊCH SỬ ĐỘC GIẢ ===================
function openBookDetails(book, imageSource) {
  const cover = document.getElementById('book-details-cover');
  cover.alt = `Bìa sách ${book.title || ''}`;
  cover.classList.toggle('book-cover-generated', imageSource.startsWith('data:image/svg+xml'));
  cover.onerror = () => {
    cover.onerror = null;
    cover.classList.add('book-cover-generated');
    cover.src = createBookCover(book);
  };
  cover.src = imageSource || getOnlineBookCover(book);

  document.getElementById('book-details-title').textContent = book.title || 'Sách chưa đặt tên';
  document.getElementById('book-details-author').textContent = book.author || 'Đang cập nhật';
  document.getElementById('book-details-category').textContent = book.category || 'Đang cập nhật';
  document.getElementById('book-details-description').textContent =
    book.description || 'Chưa có nội dung giới thiệu cho cuốn sách này.';
  openModal('modal-book-details');
}

function openBorrowModal(id, title, shelf) {
  if (!currentUser) {
    alert('Vui lòng đăng nhập trước khi đăng ký mượn sách!');
    openModal('modal-login');
    return;
  }
  document.getElementById('borrow-book-id').value = id;
  document.getElementById('borrow-book-title').textContent = title;
  document.getElementById('borrow-shelf').textContent = shelf;

  // Đặt mặc định hạn trả là 14 ngày tới
  const next2Weeks = new Date();
  next2Weeks.setDate(next2Weeks.getDate() + 14);
  const localDate = (date) => {
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60 * 1000).toISOString().split('T')[0];
  };
  const dueDateInput = document.getElementById('borrow-due-date');
  dueDateInput.min = localDate(new Date());
  dueDateInput.value = localDate(next2Weeks);

  openModal('modal-borrow');
}

async function submitBorrowBook(e) {
  e.preventDefault();
  const bookId = document.getElementById('borrow-book-id').value;
  const dueDate = document.getElementById('borrow-due-date').value;

  try {
    const res = await fetch(apiUrl('/api/borrow'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ bookId, dueDate })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Không thể đăng ký mượn sách.');
    alert(data.message);
    closeModal('modal-borrow');
    fetchBooks();
  } catch (error) {
    alert(error.message || 'Không thể kết nối máy chủ.');
  }
}

async function fetchMyLoans() {
  const tbody = document.getElementById('my-loans-table');
  try {
    const res = await fetch(apiUrl('/api/my-loans'), {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const data = await res.json();
    if (!res.ok || !Array.isArray(data)) throw new Error(data.message || 'Không thể tải lịch sử mượn.');
    tbody.innerHTML = data.map(r => {
      const isReturned = r.status === 'RETURNED';
      return `
      <tr>
        <td>#${Number(r.id)}</td>
        <td><strong>${escapeHtml(r.book_id)}</strong></td>
        <td>${escapeHtml(r.title)}</td>
        <td>${escapeHtml(r.borrow_date)}</td>
        <td>${escapeHtml(r.due_date)}</td>
        <td>${r.return_date ? escapeHtml(r.return_date) : '<span class="text-danger">Chưa trả</span>'}</td>
        <td>
          <span class="book-status ${isReturned ? 'status-available' : 'status-partial'}">
            ${isReturned ? 'Đã hoàn tất trả' : 'Đang mượn'}
          </span>
        </td>
      </tr>
      `;
    }).join('');
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="7">${escapeHtml(error.message || 'Không thể tải dữ liệu.')}</td></tr>`;
  }
}

// =================== QUẢN TRỊ ADMIN ===================
async function loadAdminDashboard() {
  // 1. Thống kê số liệu
  const statRes = await fetch(apiUrl('/api/admin/stats'), {
    headers: { 'Authorization': `Bearer ${currentToken}` }
  });
  const stats = await statRes.json();
  if (!statRes.ok) throw new Error(stats.message || 'Không thể tải thống kê quản trị.');
  document.getElementById('stat-total').textContent = stats.total;
  document.getElementById('stat-available').textContent = stats.available;
  document.getElementById('stat-borrowing').textContent = stats.borrowing;
  document.getElementById('stat-out').textContent = stats.outOfStock;

  // 2. Nạp bảng sách
  const booksRes = await fetch(apiUrl('/api/books'));
  const books = await booksRes.json();
  if (!booksRes.ok || !Array.isArray(books)) {
    throw new Error(books.message || 'Không thể tải kho sách quản trị.');
  }
  const tbodyBooks = document.getElementById('admin-books-table');
  tbodyBooks.innerHTML = books.map((b, index) => `
      <tr>
        <td><strong>${escapeHtml(b.id)}</strong></td>
        <td><img data-book-cover-index="${index}" alt="Bìa sách ${escapeHtml(b.title)}" width="40" height="50" loading="lazy"></td>
        <td>${escapeHtml(b.title)}</td>
        <td>${escapeHtml(b.author)}</td>
        <td>${escapeHtml(b.category)}</td>
        <td>${escapeHtml(b.shelf_location || 'Chưa cập nhật')}</td>
        <td>${Number(b.total_quantity) || 0}</td>
        <td>${Number(b.available_quantity) || 0}</td>
        <td>
          <span class="book-status ${b.available_quantity === 0 ? 'status-out' : 'status-available'}">
            ${b.available_quantity > 0 ? 'Còn' : 'Hết'}
          </span>
        </td>
        <td>
          <button class="btn btn-danger" style="padding:4px 8px;" data-delete-book="${escapeHtml(b.id)}" aria-label="Xóa ${escapeHtml(b.title)}"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
        </td>
      </tr>
    `).join('');
  tbodyBooks.querySelectorAll('img[data-book-cover-index]').forEach((image) => {
    const book = books[Number(image.dataset.bookCoverIndex)];
    if (book) setBookCover(image, book);
  });

  // 3. Nạp danh sách phiếu mượn
  const loansRes = await fetch(apiUrl('/api/admin/loans'), {
    headers: { 'Authorization': `Bearer ${currentToken}` }
  });
  const loans = await loansRes.json();
  if (!loansRes.ok || !Array.isArray(loans)) {
    throw new Error(loans.message || 'Không thể tải danh sách phiếu mượn.');
  }
  const tbodyLoans = document.getElementById('admin-loans-table');
  tbodyLoans.innerHTML = '';
  loans.forEach(l => {
    tbodyLoans.innerHTML += `
      <tr>
        <td>#${l.id}</td>
        <td>${escapeHtml(l.user_name)}</td>
        <td>${escapeHtml(l.user_phone)}</td>
        <td>${escapeHtml(l.book_title)} (${escapeHtml(l.book_id)})</td>
        <td>${escapeHtml(l.borrow_date)}</td>
        <td>${escapeHtml(l.due_date)}</td>
        <td>
          <span class="book-status ${l.status === 'RETURNED' ? 'status-available' : 'status-partial'}">
            ${l.status === 'RETURNED' ? 'Đã trả' : 'Đang mượn'}
          </span>
        </td>
        <td>
          ${l.status !== 'RETURNED'
            ? `<button class="btn btn-primary" style="padding:4px 8px;" onclick="confirmReturn(${l.id})"><i class="fa-solid fa-check"></i> Xác nhận trả</button>`
            : '<span style="color:gray;">Hoàn tất</span>'}
        </td>
      </tr>
    `;
  });
}

async function confirmReturn(recordId) {
  if (!confirm(`Xác nhận độc giả đã trả sách cho phiếu #${recordId}?`)) return;
  try {
    const res = await fetch(apiUrl('/api/admin/return-book'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ recordId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Không thể cập nhật phiếu mượn.');
    alert(data.message);
    await loadAdminDashboard();
  } catch (error) {
    alert(error.message || 'Không thể kết nối máy chủ.');
  }
}

function openAddBookModal() {
  document.getElementById('form-book').reset();
  document.getElementById('b-id').removeAttribute('readonly');
  openModal('modal-book');
}

async function handleSaveBook(e) {
  e.preventDefault();
  const bookData = {
    id: document.getElementById('b-id').value.trim(),
    title: document.getElementById('b-title').value.trim(),
    author: document.getElementById('b-author').value.trim(),
    category: document.getElementById('b-category').value,
    publisher: document.getElementById('b-publisher').value.trim(),
    publish_year: parseInt(document.getElementById('b-year').value),
    shelf_location: document.getElementById('b-shelf').value.trim(),
    description: document.getElementById('b-desc').value.trim(),
    image_url: document.getElementById('b-image').value.trim(),
    total_quantity: parseInt(document.getElementById('b-total').value)
  };

  try {
    const res = await fetch(apiUrl('/api/admin/books'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify(bookData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Không thể lưu sách.');
    alert(data.message);
    closeModal('modal-book');
    await loadAdminDashboard();
  } catch (error) {
    alert(error.message || 'Không thể kết nối máy chủ.');
  }
}

async function deleteBook(id) {
  if (!confirm(`Bạn có chắc chắn muốn xoá đầu sách ${id} khỏi thư viện?`)) return;
  try {
    const res = await fetch(apiUrl(`/api/admin/books/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Không thể xóa sách.');
    alert(data.message);
    await loadAdminDashboard();
  } catch (error) {
    alert(error.message || 'Không thể kết nối máy chủ.');
  }
}

// =================== XỬ LÝ AUTH MODAL ===================
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Email hoặc mật khẩu không chính xác.');
    localStorage.setItem('vanson_token', data.token);
    localStorage.setItem('vanson_user', JSON.stringify(data.user));
    currentUser = data.user;
    currentToken = data.token;
    renderAuthUI();
    closeModal('modal-login');
    alert(`Chào mừng ${currentUser.name}!`);
  } catch (error) {
    alert(error.message || 'Không thể kết nối máy chủ.');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const password = document.getElementById('reg-password').value;

  try {
    const res = await fetch(apiUrl('/api/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Không thể tạo tài khoản.');
    alert(data.message);
    closeModal('modal-register');
    openModal('modal-login');
  } catch (error) {
    alert(error.message || 'Không thể kết nối máy chủ.');
  }
}

// MODAL CONTROLLERS
function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    document.querySelectorAll('.modal.show').forEach((modal) => closeModal(modal.id));
  }
});
