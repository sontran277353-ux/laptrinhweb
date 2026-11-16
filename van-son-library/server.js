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
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role }
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
  const { bookId, dueDate, borrowerName, borrowerEmail, borrowerPhone } = req.body;
  const userId = req.user.id;

  const name = typeof borrowerName === 'string' ? borrowerName.trim() : '';
  const email = typeof borrowerEmail === 'string' ? borrowerEmail.trim() : '';
  const phone = typeof borrowerPhone === 'string' ? borrowerPhone.trim() : '';
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phonePattern = /^[0-9]{10,11}$/;
  const dueTimestamp = Date.parse(`${dueDate}T00:00:00Z`);
  const today = new Date().toISOString().split('T')[0];

  if (!bookId || !dueDate || !name || !email || !phone) {
    return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin người mượn và ngày hẹn trả!' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !Number.isFinite(dueTimestamp) || dueDate < today) {
    return res.status(400).json({ message: 'Ngày hẹn trả phải là ngày hợp lệ, không sớm hơn hôm nay.' });
  }
  if (name.length > 100 || email.length > 254 || !emailPattern.test(email) || !phonePattern.test(phone)) {
    return res.status(400).json({ message: 'Thông tin người mượn không hợp lệ. Vui lòng kiểm tra họ tên, email và số điện thoại.' });
  }

  db.serialize(() => {
    // 1. Kiểm tra tồn kho
    db.get(`SELECT available_quantity, title, rental_price_per_day FROM books WHERE id = ?`, [bookId], (err, book) => {
      if (err || !book) return res.status(404).json({ message: 'Không tìm thấy sách với mã ID này!' });
      if (book.available_quantity <= 0) {
        return res.status(400).json({ message: `Sách "${book.title}" hiện đã hết trong kho!` });
      }

      // 2. Tạo phiếu mượn
      const insertBorrow = `INSERT INTO borrow_records
        (user_id, book_id, due_date, status, borrower_name, borrower_email, borrower_phone, rental_price_per_day)
        VALUES (?, ?, ?, 'BORROWED', ?, ?, ?, ?)`;
      db.run(insertBorrow, [userId, bookId, dueDate, name, email, phone, book.rental_price_per_day], function(bErr) {
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

app.post('/api/my-loans/:id/return-request', verifyToken, (req, res) => {
  const recordId = Number(req.params.id);
  if (!Number.isSafeInteger(recordId) || recordId <= 0) {
    return res.status(400).json({ message: 'Mã phiếu mượn không hợp lệ.' });
  }

  db.get(
    `SELECT id, status FROM borrow_records WHERE id = ? AND user_id = ?`,
    [recordId, req.user.id],
    (err, record) => {
      if (err) return res.status(500).json({ message: 'Không thể kiểm tra phiếu mượn.' });
      if (!record) return res.status(404).json({ message: 'Không tìm thấy phiếu mượn của bạn.' });
      if (record.status === 'RETURNED') {
        return res.status(400).json({ message: 'Sách trong phiếu này đã được xác nhận trả.' });
      }
      if (record.status === 'RETURN_REQUESTED') {
        return res.status(400).json({ message: 'Bạn đã gửi yêu cầu trả sách cho phiếu này.' });
      }
      if (record.status !== 'BORROWED') {
        return res.status(400).json({ message: 'Phiếu mượn hiện không thể gửi yêu cầu trả.' });
      }

      db.run(
        `UPDATE borrow_records SET status = 'RETURN_REQUESTED'
         WHERE id = ? AND user_id = ? AND status = 'BORROWED'`,
        [recordId, req.user.id],
        function(updateError) {
          if (updateError) return res.status(500).json({ message: 'Không thể gửi yêu cầu trả sách.' });
          if (this.changes !== 1) {
            return res.status(409).json({ message: 'Trạng thái phiếu đã thay đổi. Hãy tải lại lịch sử mượn.' });
          }
          res.json({ message: 'Đã gửi yêu cầu trả sách. Vui lòng chờ thư viện xác nhận.' });
        }
      );
    }
  );
});

// =================== ADMIN CRUD & MANAGEMENT ===================
app.post('/api/admin/books', verifyAdmin, (req, res) => {
  const { id, title, author, category, publisher, publish_year, shelf_location, description, image_url, total_quantity, rental_price_per_day } = req.body;
  const dailyPrice = Number(rental_price_per_day);
  if (!id || !title || !author || !category || !total_quantity) {
    return res.status(400).json({ message: 'Vui lòng điền đủ các trường bắt buộc!' });
  }
  if (!Number.isInteger(dailyPrice) || dailyPrice < 15000 || dailyPrice > 30000) {
    return res.status(400).json({ message: 'Giá mượn mỗi ngày phải từ 15.000 đến 30.000 VND.' });
  }
  const sql = `INSERT INTO books (id, title, author, category, publisher, publish_year, shelf_location, description, image_url, rental_price_per_day, total_quantity, available_quantity)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  db.run(sql, [id, title, author, category, publisher, publish_year, shelf_location, description, image_url, dailyPrice, total_quantity, total_quantity], function(err) {
    if (err) return res.status(400).json({ message: 'Mã ID sách đã tồn tại hoặc dữ liệu sai!' });
    res.status(201).json({ message: 'Thêm sách mới vào thư viện thành công!' });
  });
});

app.put('/api/admin/books/:id', verifyAdmin, (req, res) => {
  const { title, author, category, publisher, publish_year, shelf_location, description, image_url, total_quantity, available_quantity, rental_price_per_day } = req.body;
  const dailyPrice = Number(rental_price_per_day);
  if (!Number.isInteger(dailyPrice) || dailyPrice < 15000 || dailyPrice > 30000) {
    return res.status(400).json({ message: 'Giá mượn mỗi ngày phải từ 15.000 đến 30.000 VND.' });
  }
  const sql = `UPDATE books SET title = ?, author = ?, category = ?, publisher = ?, publish_year = ?, 
               shelf_location = ?, description = ?, image_url = ?, rental_price_per_day = ?, total_quantity = ?, available_quantity = ?
               WHERE id = ?`;
  db.run(sql, [title, author, category, publisher, publish_year, shelf_location, description, image_url, dailyPrice, total_quantity, available_quantity, req.params.id], function(err) {
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
  const sql = `SELECT r.*,
               COALESCE(NULLIF(r.borrower_name, ''), u.name) as user_name,
               COALESCE(NULLIF(r.borrower_email, ''), u.email) as user_email,
               COALESCE(NULLIF(r.borrower_phone, ''), u.phone) as user_phone,
               b.title as book_title
               FROM borrow_records r 
               JOIN users u ON r.user_id = u.id 
               JOIN books b ON r.book_id = b.id 
               ORDER BY r.id DESC`;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Lỗi nạp danh sách mượn trả!' });
    res.json(rows);
  });
});

app.get('/api/admin/return-requests', verifyAdmin, (req, res) => {
  db.get(
    `SELECT COUNT(*) AS count, MAX(id) AS latest_id
     FROM borrow_records
     WHERE status = 'RETURN_REQUESTED'`,
    (countError, result) => {
      if (countError) return res.status(500).json({ message: 'Không thể tải thông báo trả sách.' });
      if (!result.count) return res.json({ count: 0, latestRequest: null });

      const sql = `SELECT r.id,
                   COALESCE(NULLIF(r.borrower_name, ''), u.name) AS user_name,
                   b.title AS book_title
                   FROM borrow_records r
                   JOIN users u ON r.user_id = u.id
                   JOIN books b ON r.book_id = b.id
                   WHERE r.id = ? AND r.status = 'RETURN_REQUESTED'`;
      db.get(sql, [result.latest_id], (requestError, latestRequest) => {
        if (requestError) return res.status(500).json({ message: 'Không thể tải thông báo trả sách.' });
        res.json({ count: result.count, latestRequest: latestRequest || null });
      });
    }
  );
});

app.post('/api/admin/return-book', verifyAdmin, (req, res) => {
  const { recordId } = req.body;
  db.get(`SELECT * FROM borrow_records WHERE id = ?`, [recordId], (err, record) => {
    if (err || !record) return res.status(404).json({ message: 'Không tìm thấy phiếu mượn!' });
    if (record.status === 'RETURNED') return res.status(400).json({ message: 'Phiếu này đã hoàn tất trả sách trước đó!' });

    const returnDate = new Date().toISOString().split('T')[0];
    const borrowTimestamp = Date.parse(`${record.borrow_date}T00:00:00Z`);
    const returnTimestamp = Date.parse(`${returnDate}T00:00:00Z`);
    const dailyPrice = Number(record.rental_price_per_day);
    if (!Number.isFinite(borrowTimestamp) || !Number.isFinite(returnTimestamp) || returnTimestamp < borrowTimestamp) {
      return res.status(500).json({ message: 'Ngày mượn hoặc ngày trả không hợp lệ, chưa thể tính phí.' });
    }
    if (!Number.isInteger(dailyPrice) || dailyPrice < 15000 || dailyPrice > 30000) {
      return res.status(500).json({ message: 'Giá mượn của phiếu không hợp lệ, chưa thể xác nhận trả.' });
    }
    const actualRentalDays = Math.max(1, Math.floor((returnTimestamp - borrowTimestamp) / 86400000));
    const rentalFee = actualRentalDays * dailyPrice;

    db.serialize(() => {
      db.run('BEGIN IMMEDIATE', (beginError) => {
        if (beginError) return res.status(500).json({ message: 'Không thể bắt đầu cập nhật phiếu trả.' });

        db.run(
          `UPDATE borrow_records
           SET status = 'RETURNED', return_date = ?, actual_rental_days = ?, rental_fee = ?
           WHERE id = ? AND status != 'RETURNED'`,
          [returnDate, actualRentalDays, rentalFee, recordId],
          function(updateError) {
            if (updateError || this.changes !== 1) {
              return db.run('ROLLBACK', () => res.status(updateError ? 500 : 409).json({
                message: updateError ? 'Không thể cập nhật phiếu trả.' : 'Phiếu mượn đã được cập nhật trước đó.'
              }));
            }

            db.run(
              `UPDATE books SET available_quantity = available_quantity + 1 WHERE id = ?`,
              [record.book_id],
              function(bookError) {
                if (bookError || this.changes !== 1) {
                  return db.run('ROLLBACK', () => res.status(500).json({
                    message: 'Không thể cập nhật tồn kho khi trả sách.'
                  }));
                }

                db.run('COMMIT', (commitError) => {
                  if (commitError) {
                    return db.run('ROLLBACK', () => res.status(500).json({
                      message: 'Không thể hoàn tất cập nhật trả sách.'
                    }));
                  }
                  const formattedFee = new Intl.NumberFormat('vi-VN').format(rentalFee);
                  res.json({
                    message: `Đã xác nhận trả sách: ${actualRentalDays} ngày × ${new Intl.NumberFormat('vi-VN').format(dailyPrice)} VND = ${formattedFee} VND.`,
                    actualRentalDays,
                    rentalFee
                  });
                });
              }
            );
          }
        );
      });
    });
  });
});

app.get('/api/admin/stats', verifyAdmin, (req, res) => {
  const queries = {
    totalBooks: `SELECT SUM(total_quantity) AS count FROM books`,
    availableBooks: `SELECT SUM(available_quantity) AS count FROM books`,
    borrowedLoans: `SELECT COUNT(*) AS count FROM borrow_records WHERE status IN ('BORROWED', 'RETURN_REQUESTED')`,
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

function ensureDatabaseColumns(callback) {
  const migrations = [
    { table: 'books', name: 'rental_price_per_day', definition: 'INTEGER NOT NULL DEFAULT 15000 CHECK (rental_price_per_day BETWEEN 15000 AND 30000)' },
    { table: 'borrow_records', name: 'borrower_name', definition: 'TEXT' },
    { table: 'borrow_records', name: 'borrower_email', definition: 'TEXT' },
    { table: 'borrow_records', name: 'borrower_phone', definition: 'TEXT' },
    { table: 'borrow_records', name: 'rental_price_per_day', definition: 'INTEGER NOT NULL DEFAULT 15000' },
    { table: 'borrow_records', name: 'actual_rental_days', definition: 'INTEGER' },
    { table: 'borrow_records', name: 'rental_fee', definition: 'INTEGER' }
  ];

  const addMigration = (index) => {
    if (index >= migrations.length) return callback(null);
    const migration = migrations[index];
    db.all(`PRAGMA table_info(${migration.table})`, (error, columns) => {
      if (error) return callback(error);
      if (columns.some((column) => column.name === migration.name)) return addMigration(index + 1);
      db.run(
        `ALTER TABLE ${migration.table} ADD COLUMN ${migration.name} ${migration.definition}`,
        (alterError) => {
          if (alterError) return callback(alterError);
          addMigration(index + 1);
        }
      );
    });
  };

  addMigration(0);
}

ensureDatabaseColumns((error) => {
  if (error) {
    console.error('Không thể cập nhật cấu trúc phiếu mượn:', error.message);
    db.close(() => process.exit(1));
    return;
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`Văn Sơn Library Server đang chạy tại: http://localhost:${PORT}`);
    console.log(`Tài khoản Admin: admin@vanson.edu.vn | Mật khẩu: Admin@123`);
    console.log(`=======================================================`);
  });
});