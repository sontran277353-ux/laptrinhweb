const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./database/db');
const { JWT_SECRET, verifyToken, verifyAdmin } = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// =================== AUTH APIS ===================
app.post('/api/auth/register', (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !phone || !password) {
    return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin!' });
  }
  const hashedPassword = bcrypt.hashSync(password, 10);
  const sql = `INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, 'Customer')`;
  db.run(sql, [name, email, phone, hashedPassword], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) return res.status(400).json({ message: 'Email đã tồn tại trên hệ thống!' });
      return res.status(500).json({ message: 'Lỗi đăng ký tài khoản.' });
    }
    res.status(201).json({ message: 'Đăng ký tài khoản độc giả thành công!' });
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
    if (err || !user) return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng!' });
    const isPasswordValid = bcrypt.compareSync(password, user.password);
    if (!isPasswordValid) return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng!' });

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({
      message: 'Đăng nhập thành công!',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  });
});

// =================== BOOKS APIS (CUSTOMER & PUBLIC) ===================
app.get('/api/books', (req, res) => {
  const { search, category } = req.query;
  let sql = `SELECT * FROM books WHERE 1=1`;
  const params = [];

  if (category && category !== 'Tất cả') {
    sql += ` AND category = ?`;
    params.push(category);
  }
  if (search) {
    sql += ` AND (id LIKE ? OR title LIKE ? OR author LIKE ?)`;
    const term = `%${search}%`;
    params.push(term, term, term);
  }
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ message: 'Lỗi khi tải kho sách.' });
    res.json(rows);
  });
});

// =================== BORROW & RETURN LOGIC ===================
app.post('/api/borrow', verifyToken, (req, res) => {
  const { bookId, dueDate } = req.body;
  const userId = req.user.id;

  if (!bookId || !dueDate) {
    return res.status(400).json({ message: 'Vui lòng cung cấp mã sách và ngày hẹn trả!' });
  }

  db.serialize(() => {
    // 1. Kiểm tra tồn kho
    db.get(`SELECT available_quantity, title FROM books WHERE id = ?`, [bookId], (err, book) => {
      if (err || !book) return res.status(404).json({ message: 'Không tìm thấy sách với mã ID này!' });
      if (book.available_quantity <= 0) {
        return res.status(400).json({ message: `Sách "${book.title}" hiện đã hết trong kho!` });
      }

      // 2. Tạo phiếu mượn
      const insertBorrow = `INSERT INTO borrow_records (user_id, book_id, due_date, status) VALUES (?, ?, ?, 'BORROWED')`;
      db.run(insertBorrow, [userId, bookId, dueDate], function(bErr) {
        if (bErr) return res.status(500).json({ message: 'Lỗi khi lập phiếu mượn!' });

        // 3. Trừ số lượng tồn kho (đảm bảo không âm)
        db.run(`UPDATE books SET available_quantity = available_quantity - 1 WHERE id = ? AND available_quantity > 0`, [bookId], (uErr) => {
          if (uErr) return res.status(500).json({ message: 'Lỗi cập nhật số lượng tồn kho!' });
          res.json({ message: `Đăng ký mượn sách "${book.title}" thành công!` });
        });
      });
    });
  });
});

app.get('/api/my-loans', verifyToken, (req, res) => {
  const sql = `SELECT r.*, b.title, b.author, b.image_url 
               FROM borrow_records r 
               JOIN books b ON r.book_id = b.id 
               WHERE r.user_id = ? 
               ORDER BY r.id DESC`;
  db.all(sql, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Lỗi nạp lịch sử mượn.' });
    res.json(rows);
  });
});

// =================== ADMIN CRUD & MANAGEMENT ===================
app.post('/api/admin/books', verifyAdmin, (req, res) => {
  const { id, title, author, category, publisher, publish_year, shelf_location, description, image_url, total_quantity } = req.body;
  if (!id || !title || !author || !category || !total_quantity) {
    return res.status(400).json({ message: 'Vui lòng điền đủ các trường bắt buộc!' });
  }
  const sql = `INSERT INTO books (id, title, author, category, publisher, publish_year, shelf_location, description, image_url, total_quantity, available_quantity)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  db.run(sql, [id, title, author, category, publisher, publish_year, shelf_location, description, image_url, total_quantity, total_quantity], function(err) {
    if (err) return res.status(400).json({ message: 'Mã ID sách đã tồn tại hoặc dữ liệu sai!' });
    res.status(201).json({ message: 'Thêm sách mới vào thư viện thành công!' });
  });
});

app.put('/api/admin/books/:id', verifyAdmin, (req, res) => {
  const { title, author, category, publisher, publish_year, shelf_location, description, image_url, total_quantity, available_quantity } = req.body;
  const sql = `UPDATE books SET title = ?, author = ?, category = ?, publisher = ?, publish_year = ?, 
               shelf_location = ?, description = ?, image_url = ?, total_quantity = ?, available_quantity = ? 
               WHERE id = ?`;
  db.run(sql, [title, author, category, publisher, publish_year, shelf_location, description, image_url, total_quantity, available_quantity, req.params.id], function(err) {
    if (err) return res.status(500).json({ message: 'Lỗi cập nhật sách!' });
    res.json({ message: 'Cập nhật thông tin sách thành công!' });
  });
});

app.delete('/api/admin/books/:id', verifyAdmin, (req, res) => {
  db.run(`DELETE FROM books WHERE id = ?`, [req.params.id], function(err) {
    if (err) return res.status(500).json({ message: 'Lỗi xoá sách!' });
    res.json({ message: 'Đã xoá sách khỏi hệ thống!' });
  });
});

app.get('/api/admin/loans', verifyAdmin, (req, res) => {
  const sql = `SELECT r.*, u.name as user_name, u.email as user_email, u.phone as user_phone, b.title as book_title 
               FROM borrow_records r 
               JOIN users u ON r.user_id = u.id 
               JOIN books b ON r.book_id = b.id 
               ORDER BY r.id DESC`;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Lỗi nạp danh sách mượn trả!' });
    res.json(rows);
  });
});

app.post('/api/admin/return-book', verifyAdmin, (req, res) => {
  const { recordId } = req.body;
  db.get(`SELECT * FROM borrow_records WHERE id = ?`, [recordId], (err, record) => {
    if (err || !record) return res.status(404).json({ message: 'Không tìm thấy phiếu mượn!' });
    if (record.status === 'RETURNED') return res.status(400).json({ message: 'Phiếu này đã hoàn tất trả sách trước đó!' });

    const returnDate = new Date().toISOString().split('T')[0];
    db.serialize(() => {
      // Cập nhật trạng thái phiếu
      db.run(`UPDATE borrow_records SET status = 'RETURNED', return_date = ? WHERE id = ?`, [returnDate, recordId]);
      // Tự động tăng lại số lượng sách sẵn sàng
      db.run(`UPDATE books SET available_quantity = available_quantity + 1 WHERE id = ?`, [record.book_id]);
      res.json({ message: 'Xác nhận trả sách thành công và đã cập nhật kho!' });
    });
  });
});

app.get('/api/admin/stats', verifyAdmin, (req, res) => {
  const queries = {
    totalBooks: `SELECT SUM(total_quantity) AS count FROM books`,
    availableBooks: `SELECT SUM(available_quantity) AS count FROM books`,
    borrowedLoans: `SELECT COUNT(*) AS count FROM borrow_records WHERE status = 'BORROWED'`,
    outOfStockBooks: `SELECT COUNT(*) AS count FROM books WHERE available_quantity = 0`
  };

  db.get(queries.totalBooks, (e1, r1) => {
    db.get(queries.availableBooks, (e2, r2) => {
      db.get(queries.borrowedLoans, (e3, r3) => {
        db.get(queries.outOfStockBooks, (e4, r4) => {
          res.json({
            total: r1.count || 0,
            available: r2.count || 0,
            borrowing: r3.count || 0,
            outOfStock: r4.count || 0
          });
        });
      });
    });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`Văn Sơn Library Server đang chạy tại: http://localhost:${PORT}`);
  console.log(`Tài khoản Admin: admin@vanson.edu.vn | Mật khẩu: Admin@123`);
  console.log(`=======================================================`);
});