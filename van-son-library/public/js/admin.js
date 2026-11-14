import { api } from './api.js';

const statusNames = {
  pending: 'Chờ duyệt',
  approved: 'Đang mượn',
  rejected: 'Từ chối',
  returned: 'Đã trả'
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function dateLabel(value) {
  return new Date(`${value.replace(' ', 'T')}Z`).toLocaleDateString('vi-VN');
}

export async function renderAdmin() {
  const [statsResult, booksResult, requestsResult] = await Promise.all([
    api.get('/api/admin/stats'),
    api.get('/api/admin/books'),
    api.get('/api/admin/borrowings')
  ]);
  const stats = statsResult.stats;
  const books = booksResult.books;
  const requests = requestsResult.borrowings;

  return `
    <div class="admin-header">
      <div><p class="eyebrow">Không gian quản trị</p><h1 class="page-title">Tổng quan thư viện</h1></div>
      <button class="button" type="button" data-action="new-book">+ Thêm sách</button>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><span>Đầu sách</span><strong>${stats.books}</strong></div>
      <div class="stat-card"><span>Độc giả</span><strong>${stats.customers}</strong></div>
      <div class="stat-card"><span>Yêu cầu chờ duyệt</span><strong>${stats.pending}</strong></div>
      <div class="stat-card"><span>Sách đang được mượn</span><strong>${stats.active}</strong></div>
    </div>
    <section class="admin-section">
      <h2>Quản lý sách</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>Tên sách</th><th>Tác giả</th><th>Còn lại</th><th>Thao tác</th></tr></thead>
        <tbody>${books.length ? books.map((book) => `
          <tr>
            <td>${escapeHtml(book.title)}</td><td>${escapeHtml(book.author)}</td>
            <td>${book.available}/${book.stock}</td>
            <td><div class="form-actions">
              <button class="button secondary small" data-action="edit-book" data-id="${book.id}">Sửa</button>
              <button class="button danger small" data-action="delete-book" data-id="${book.id}">Xóa</button>
            </div></td>
          </tr>`).join('') : '<tr><td colspan="4">Chưa có sách.</td></tr>'}</tbody>
      </table></div>
    </section>
    <section class="admin-section">
      <h2>Yêu cầu mượn trả</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>Độc giả</th><th>Sách</th><th>Ngày đăng ký</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
        <tbody>${requests.length ? requests.map((request) => `
          <tr>
            <td>${escapeHtml(request.customer_name)}<br><span class="availability">${escapeHtml(request.customer_email)}</span></td>
            <td>${escapeHtml(request.book_title)}<br><span class="availability">${escapeHtml(request.book_author)}</span></td>
            <td>${dateLabel(request.requested_at)}</td>
            <td><span class="status ${request.status}">${statusNames[request.status]}</span></td>
            <td>${request.status === 'pending' ? `
              <div class="form-actions">
                <button class="button small" data-action="update-request" data-id="${request.id}" data-status="approved">Duyệt</button>
                <button class="button danger small" data-action="update-request" data-id="${request.id}" data-status="rejected">Từ chối</button>
              </div>` : request.status === 'approved' ? `
              <button class="button secondary small" data-action="update-request" data-id="${request.id}" data-status="returned">Đánh dấu đã trả</button>` : '—'}</td>
          </tr>`).join('') : '<tr><td colspan="5">Chưa có yêu cầu mượn.</td></tr>'}</tbody>
      </table></div>
    </section>
  `;
}

export function showBookForm(book = null) {
  const form = document.querySelector('#book-form');
  form.elements.id.value = book?.id ?? '';
  form.elements.title.value = book?.title ?? '';
  form.elements.author.value = book?.author ?? '';
  form.elements.category.value = book?.category ?? '';
  form.elements.stock.value = book?.stock ?? 1;
  form.elements.cover_url.value = book?.cover_url ?? '';
  form.elements.description.value = book?.description ?? '';
  document.querySelector('#book-dialog-title').textContent = book ? 'Cập nhật sách' : 'Thêm sách mới';
  document.querySelector('#book-dialog').showModal();
}

export async function handleAdminAction(action, id, status) {
  if (action === 'new-book') {
    showBookForm();
    return;
  }
  if (action === 'edit-book') {
    const { books } = await api.get('/api/admin/books');
    const book = books.find((item) => item.id === Number(id));
    if (!book) {
      throw new Error('Không tìm thấy sách cần sửa.');
    }
    showBookForm(book);
    return;
  }
  if (action === 'delete-book') {
    if (!window.confirm('Bạn có chắc muốn xóa sách này?')) {
      return;
    }
    await api.delete(`/api/admin/books/${id}`);
    window.dispatchEvent(new CustomEvent('notice', { detail: 'Đã xóa sách.' }));
    return;
  }
  if (action === 'update-request') {
    await api.patch(`/api/admin/borrowings/${id}`, { status });
    window.dispatchEvent(new CustomEvent('notice', { detail: 'Đã cập nhật yêu cầu mượn.' }));
  }
}

export async function saveBook(form) {
  const values = Object.fromEntries(new FormData(form).entries());
  const id = values.id;
  delete values.id;
  values.stock = Number(values.stock);
  if (id) {
    await api.put(`/api/admin/books/${id}`, values);
  } else {
    await api.post('/api/admin/books', values);
  }
}
