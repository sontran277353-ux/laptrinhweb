const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.resolve(__dirname, 'library.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Lỗi kết nối CSDL:', err.message);
  else console.log('Đã kết nối SQLite Database thành công.');
});

db.serialize(() => {
  // 1. Bảng Người dùng
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'Customer',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 2. Bảng Sách
  db.run(`CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    category TEXT NOT NULL,
    publisher TEXT,
    publish_year INTEGER,
    shelf_location TEXT,
    description TEXT,
    image_url TEXT,
    total_quantity INTEGER NOT NULL,
    available_quantity INTEGER NOT NULL
  )`);

  // 3. Bảng Phiếu Mượn
  db.run(`CREATE TABLE IF NOT EXISTS borrow_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    book_id TEXT NOT NULL,
    borrow_date DATE DEFAULT (DATE('now')),
    due_date DATE NOT NULL,
    return_date DATE,
    status TEXT DEFAULT 'BORROWED',
    notes TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(book_id) REFERENCES books(id)
  )`);

  // Khởi tạo tài khoản quản trị mặc định và độc giả mẫu
  db.get("SELECT COUNT(*) AS count FROM users", (err, row) => {
    if (row && row.count === 0) {
      const hashAdmin = bcrypt.hashSync('Admin@123', 10);
      const hashUser = bcrypt.hashSync('User@123', 10);
      db.run(`INSERT INTO users (name, email, phone, password, role) VALUES 
        ('Admin Văn Sơn', 'admin@vanson.edu.vn', '0901234567', ?, 'Admin'),
        ('Nguyễn Văn Độc Giả', 'customer@gmail.com', '0987654321', ?, 'Customer')`, 
        [hashAdmin, hashUser]
      );
      console.log('Khởi tạo tài khoản mẫu thành công.');
    }
  });

  const originalBooks = [
    ['BK-001', 'Lập Trình Web Hiện Đại', 'Văn Sơn', 'Sách giáo khoa', 'NXB Giáo Dục', 2025, 'Kệ A1-02', 'Cẩm nang lập trình HTML, CSS, JavaScript, Node.js.', 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400', 10, 8],
    ['BK-002', 'Sherlock Holmes Toàn Tập', 'Arthur Conan Doyle', 'Sách trinh thám', 'NXB Văn Học', 2021, 'Kệ B2-05', 'Những vụ án ly kỳ của thám tử đại tài.', 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400', 5, 0],
    ['BK-003', 'Từ Điển Anh - Việt Hiện Đại', 'Viện Ngôn Ngữ', 'Sách từ điển', 'NXB Trẻ', 2023, 'Kệ C1-01', 'Tra cứu hơn 150.000 từ vựng và ngữ pháp.', 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400', 8, 8],
    ['BK-004', 'Đắc Nhân Tâm', 'Dale Carnegie', 'Sách kỹ năng', 'NXB Tổng Hợp', 2022, 'Kệ D3-12', 'Nghệ thuật giao tiếp và đối nhân xử thế.', 'https://images.unsplash.com/photo-1532012164546-f432f2e3777a?w=400', 15, 12],
    ['BK-005', 'Tạp Chí Khoa Học Công Nghệ', 'Bộ KH&CN', 'Sách báo', 'NXB Khoa Học', 2026, 'Kệ E1-03', 'Cập nhật xu hướng AI và mạng máy tính mới nhất.', 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400', 20, 20],
    ['BK-006', 'Mắt Biếc', 'Nguyễn Nhật Ánh', 'Sách văn học', 'NXB Trẻ', 2019, 'Kệ F2-08', 'Câu chuyện tình cảm học trò da diết và xúc động.', 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=400', 12, 11]
  ];

  const categoryBooks = [
    {
      category: 'Sách báo',
      books: [
        ['Tạp chí Khám phá Khoa học', 'Ban biên tập Khoa học'],
        ['Toàn cảnh Công nghệ số', 'Ban biên tập Công nghệ'],
        ['Bản tin Môi trường xanh', 'Trung tâm Môi trường'],
        ['Chuyên san Giáo dục hôm nay', 'Viện Nghiên cứu Giáo dục'],
        ['Tạp chí Văn hóa Việt', 'Hội Văn hóa Việt Nam'],
        ['Kinh tế và Đời sống', 'Ban biên tập Kinh tế'],
        ['Thế giới Thiên nhiên', 'Trung tâm Bảo tồn Thiên nhiên'],
        ['Sức khỏe cộng đồng', 'Hội Y tế Cộng đồng'],
        ['Tạp chí Du lịch bốn phương', 'Ban biên tập Du lịch'],
        ['Nhịp sống Thành phố', 'Tòa soạn Nhịp sống'],
        ['Chuyên san Nông nghiệp mới', 'Viện Nông nghiệp'],
        ['Tài chính cá nhân', 'Ban biên tập Tài chính'],
        ['Khoa học tuổi trẻ', 'Liên hiệp Hội Khoa học'],
        ['Tạp chí Kiến trúc và Nhà đẹp', 'Hội Kiến trúc sư'],
        ['Bản tin Lịch sử và Di sản', 'Trung tâm Di sản'],
        ['Sáng tạo và Khởi nghiệp', 'Cộng đồng Khởi nghiệp'],
        ['Tạp chí Mỹ thuật đương đại', 'Hội Mỹ thuật'],
        ['Đời sống số', 'Ban biên tập Truyền thông số'],
        ['Chuyên đề Khám phá vũ trụ', 'Câu lạc bộ Thiên văn']
      ]
    },
    {
      category: 'Sách ngôn tình',
      books: [
        ['Mùa hạ viết cho chúng ta', 'Nguyễn An Nhiên'],
        ['Hẹn nhau nơi phố cũ', 'Lê Minh Châu'],
        ['Ngày em mang nắng đến', 'Trần Thảo Vy'],
        ['Tháng năm còn có anh', 'Phạm Gia Linh'],
        ['Bức thư gửi mùa thu', 'Hoàng Yến Nhi'],
        ['Khoảng trời sau ô cửa', 'Đỗ Thanh Hà'],
        ['Chạm vào miền ký ức', 'Võ Khánh Ngọc'],
        ['Đi qua mùa thương nhớ', 'Bùi Hải An'],
        ['Từ ấy mình có nhau', 'Nguyễn Quỳnh Mai'],
        ['Gặp lại giữa mùa mưa', 'Lâm Tú Anh'],
        ['Nơi trái tim bình yên', 'Phan Ngọc Diệp'],
        ['Một ngày xanh rất khác', 'Mai Phương Thảo'],
        ['Lời hẹn dưới hàng cây', 'Đặng Bảo Trân'],
        ['Cà phê và những cuộc hẹn', 'Dương Khánh Ly'],
        ['Phía cuối con đường nhỏ', 'Trịnh Minh Khuê'],
        ['Thành phố có mùa yêu', 'Vũ Hà My'],
        ['Gửi người năm ấy', 'Lý Thanh Tâm'],
        ['Ngày mai mình gặp lại', 'Cao Bảo Ngân'],
        ['Mùa đông không lạnh', 'Đinh Ngọc Anh'],
        ['Nắm tay qua ngày giông', 'Phạm Thu Trang']
      ]
    },
    {
      category: 'Sách trinh thám',
      books: [
        ['Bí ẩn căn phòng khóa kín', 'Nguyễn Hoàng Minh'],
        ['Dấu chân bên cửa sổ', 'Lê Quang Huy'],
        ['Hồ sơ đêm mưa', 'Trần Đức Anh'],
        ['Vụ án ở ga cuối', 'Phạm Tuấn Kiệt'],
        ['Bức thư không người gửi', 'Vũ Hải Nam'],
        ['Mật mã trên tấm bản đồ', 'Đỗ Nhật Long'],
        ['Người khách lúc nửa đêm', 'Hoàng Minh Tân'],
        ['Bóng người trong ngõ vắng', 'Nguyễn Thành Đạt'],
        ['Chiếc đồng hồ dừng lại', 'Bùi Anh Khoa'],
        ['Cuộc gọi từ số máy lạ', 'Phan Quốc Bảo'],
        ['Vết mực trên trang sách', 'Lâm Gia Hưng'],
        ['Hành lang không ánh sáng', 'Đặng Công Thành'],
        ['Bí mật dưới tầng hầm', 'Trịnh Hải Đăng'],
        ['Chiếc vali ở bến cảng', 'Dương Minh Phúc'],
        ['Mảnh ghép thứ mười', 'Cao Nhật Khánh'],
        ['Ngôi nhà cuối con dốc', 'Lý Hoàng Phong'],
        ['Án mạng trong bảo tàng', 'Mai Đức Thịnh'],
        ['Dấu vết trên mặt hồ', 'Võ Thanh Tùng'],
        ['Nhân chứng im lặng', 'Đinh Quang Vinh']
      ]
    },
    {
      category: 'Sách từ điển',
      books: [
        ['Từ điển Việt - Anh thực hành', 'Viện Ngôn ngữ học'],
        ['Từ điển Anh - Việt chuyên ngành', 'Nguyễn Thanh Bình'],
        ['Từ điển tiếng Việt phổ thông', 'Hoàng Phê'],
        ['Từ điển Pháp - Việt căn bản', 'Trần Văn Hùng'],
        ['Từ điển Nhật - Việt giao tiếp', 'Lê Thu Hương'],
        ['Từ điển Hàn - Việt hiện đại', 'Phạm Ngọc Lan'],
        ['Từ điển Trung - Việt thông dụng', 'Vũ Minh Phương'],
        ['Từ điển thành ngữ và tục ngữ', 'Nguyễn Lân'],
        ['Từ điển thuật ngữ tin học', 'Hội Tin học Việt Nam'],
        ['Từ điển thuật ngữ kinh tế', 'Đại học Kinh tế Quốc dân'],
        ['Từ điển sinh học minh họa', 'Lê Trọng Cúc'],
        ['Từ điển địa danh Việt Nam', 'Nguyễn Văn Tân'],
        ['Từ điển đồng nghĩa tiếng Việt', 'Nguyễn Đức Dương'],
        ['Từ điển chính tả tiếng Việt', 'Viện Ngôn ngữ học'],
        ['Từ điển thuật ngữ y học', 'Đại học Y Hà Nội'],
        ['Từ điển nghệ thuật và mỹ thuật', 'Trần Văn Cẩn'],
        ['Từ điển tiếng Anh cho học sinh', 'Nguyễn Quốc Hùng'],
        ['Từ điển thuật ngữ môi trường', 'Lê Văn Khoa'],
        ['Từ điển văn học Việt Nam', 'Đỗ Đức Hiểu']
      ]
    },
    {
      category: 'Sách văn học',
      books: [
        ['Dòng sông mùa hạ', 'Nguyễn Minh Châu'],
        ['Những ngày ở miền cát', 'Nguyễn Quang Thiều'],
        ['Chuyện kể bên hiên nhà', 'Nguyễn Nhật Ánh'],
        ['Mùa lá rụng trong vườn', 'Ma Văn Kháng'],
        ['Bến quê', 'Nguyễn Minh Châu'],
        ['Vang bóng một thời', 'Nguyễn Tuân'],
        ['Tuyển tập thơ Xuân Diệu', 'Xuân Diệu'],
        ['Thơ chọn lọc Huy Cận', 'Huy Cận'],
        ['Truyện ngắn Nam Cao', 'Nam Cao'],
        ['Tuyển tập truyện Thạch Lam', 'Thạch Lam'],
        ['Đất rừng phương Nam', 'Đoàn Giỏi'],
        ['Quê nội', 'Võ Quảng'],
        ['Tuổi thơ dữ dội', 'Phùng Quán'],
        ['Nỗi buồn chiến tranh', 'Bảo Ninh'],
        ['Cánh đồng bất tận', 'Nguyễn Ngọc Tư'],
        ['Thời xa vắng', 'Lê Lựu'],
        ['Số đỏ', 'Vũ Trọng Phụng'],
        ['Truyện Kiều', 'Nguyễn Du'],
        ['Thơ Hồ Xuân Hương tuyển chọn', 'Hồ Xuân Hương']
      ]
    },
    {
      category: 'Sách giáo khoa',
      books: [
        ['Toán học cơ bản lớp 6', 'Nguyễn Huy Đoan'],
        ['Ngữ văn và đọc hiểu lớp 6', 'Bùi Minh Toán'],
        ['Tiếng Anh nền tảng lớp 7', 'Hoàng Văn Vân'],
        ['Vật lý nhập môn trung học', 'Vũ Thanh Khiết'],
        ['Hóa học đại cương phổ thông', 'Lê Xuân Trọng'],
        ['Sinh học và môi trường', 'Nguyễn Quang Vinh'],
        ['Lịch sử Việt Nam qua các thời kỳ', 'Phan Ngọc Liên'],
        ['Địa lý tự nhiên Việt Nam', 'Lê Thông'],
        ['Tin học ứng dụng cơ bản', 'Quách Tuấn Ngọc'],
        ['Công nghệ và đời sống học đường', 'Nguyễn Văn Khôi'],
        ['Giáo dục công dân thực hành', 'Nguyễn Hải Châu'],
        ['Toán tư duy và hình học', 'Trần Diên Hiển'],
        ['Ngữ pháp tiếng Việt căn bản', 'Diệp Quang Ban'],
        ['Tiếng Anh giao tiếp học đường', 'Mai Lan Hương'],
        ['Khoa học tự nhiên thực nghiệm', 'Cao Cự Giác'],
        ['Bài tập Toán nâng cao lớp 8', 'Vũ Hữu Bình'],
        ['Tập làm văn và kỹ năng viết', 'Nguyễn Trí'],
        ['Lịch sử thế giới hiện đại', 'Nguyễn Anh Thái'],
        ['Địa lý kinh tế và xã hội', 'Nguyễn Viết Thịnh']
      ]
    },
    {
      category: 'Sách kỹ năng',
      books: [
        ['Kỹ năng giao tiếp hiệu quả', 'Nguyễn Thị Oanh'],
        ['Quản lý thời gian cho người bận rộn', 'Trần Đăng Khoa'],
        ['Tư duy phản biện mỗi ngày', 'Nguyễn Thành Long'],
        ['Nghệ thuật thuyết trình tự tin', 'Lê A'],
        ['Lắng nghe để thấu hiểu', 'Phạm Thị Thu Hà'],
        ['Làm việc nhóm cùng tiến bộ', 'Đỗ Hồng Ngọc'],
        ['Kỹ năng giải quyết vấn đề', 'Vũ Gia Hiền'],
        ['Lập kế hoạch học tập thông minh', 'Nguyễn Cảnh Toàn'],
        ['Tư duy sáng tạo trong công việc', 'Phan Dũng'],
        ['Xây dựng thói quen tích cực', 'Nguyễn Hiến Lê'],
        ['Kỹ năng quản lý tài chính cá nhân', 'Lâm Minh Chánh'],
        ['Học cách đặt mục tiêu', 'Brian Tracy'],
        ['Đọc nhanh và ghi nhớ tốt', 'Tony Buzan'],
        ['Nghệ thuật đàm phán căn bản', 'Roger Fisher'],
        ['Tự tin trước đám đông', 'Dale Carnegie'],
        ['Kỹ năng lãnh đạo thực tiễn', 'John C. Maxwell'],
        ['Làm chủ cảm xúc của bạn', 'Trần Việt Quân'],
        ['Phương pháp học tập chủ động', 'Nguyễn Kỳ'],
        ['Viết để thuyết phục', 'William Zinsser']
      ]
    },
    {
      category: 'Các thể loại khác',
      books: [
        ['Bản đồ du lịch Việt Nam', 'Tổng cục Du lịch'],
        ['Nghệ thuật nhiếp ảnh căn bản', 'Nguyễn Vũ Phước'],
        ['Ẩm thực ba miền Việt Nam', 'Triệu Thị Chơi'],
        ['Nhập môn thiết kế đồ họa', 'Lê Huy Văn'],
        ['Làm vườn tại nhà', 'Nguyễn Công Thuận'],
        ['Khám phá bầu trời đêm', 'Hội Thiên văn Việt Nam'],
        ['Lịch sử kiến trúc thế giới', 'Lê Thanh Sơn'],
        ['Cẩm nang chăm sóc sức khỏe', 'Đại học Y Dược TP.HCM'],
        ['Khoa học thường thức quanh ta', 'Vũ Bội Tuyền'],
        ['Hướng dẫn vẽ màu nước', 'Trần Thị Huyền'],
        ['Du ký miền núi phía Bắc', 'Nguyễn Tuấn Anh'],
        ['Âm nhạc và nhạc cụ dân tộc', 'Tô Vũ'],
        ['Cẩm nang công nghệ số', 'Nguyễn Long'],
        ['Thế giới động vật hoang dã', 'Phạm Nhật'],
        ['Nhập môn thiên văn học', 'Đặng Vũ Tuấn Sơn'],
        ['Chăm sóc cây cảnh trong nhà', 'Trần Hợp'],
        ['Văn hóa cà phê Việt Nam', 'Nguyễn Đình Tư'],
        ['Lịch sử hàng hải Việt Nam', 'Nguyễn Văn Kim'],
        ['Sổ tay sửa chữa gia đình', 'Lê Văn Tứ'],
        ['Khám phá các kỳ quan thế giới', 'Nguyễn Chí Bền']
      ]
    }
  ];

  const sampleBooks = [...originalBooks];
  let nextBookId = 7;
  categoryBooks.forEach((group, groupIndex) => {
    group.books.slice(0, 3).forEach(([title, author], bookIndex) => {
      const id = `BK-${String(nextBookId).padStart(3, '0')}`;
      const shelf = String.fromCharCode(65 + groupIndex);
      const shelfNumber = String(bookIndex + 1).padStart(2, '0');
      sampleBooks.push([
        id,
        title,
        author,
        group.category,
        'Văn Sơn Library',
        2020 + (bookIndex % 7),
        `Kệ ${shelf}-${shelfNumber}`,
        `Tài liệu tham khảo thuộc danh mục ${group.category.toLowerCase()}.`,
        '',
        5,
        5
      ]);
      nextBookId += 1;
    });
  });

  const sampleBookIds = sampleBooks.map((book) => book[0]);
  const sampleBookPlaceholders = sampleBookIds.map(() => '?').join(', ');
  db.run(
    `DELETE FROM books
     WHERE publisher = 'Văn Sơn Library'
       AND image_url = ''
       AND description LIKE 'Tài liệu tham khảo thuộc danh mục %'
       AND total_quantity = 5
       AND available_quantity = 5
       AND id NOT IN (${sampleBookPlaceholders})
       AND NOT EXISTS (
         SELECT 1 FROM borrow_records WHERE borrow_records.book_id = books.id
       )`,
    sampleBookIds,
    (error) => {
      if (error) console.error('Lỗi dọn sách mẫu cũ:', error.message);
    }
  );

  const insertBook = db.prepare(`
    INSERT OR IGNORE INTO books
      (id, title, author, category, publisher, publish_year, shelf_location,
       description, image_url, total_quantity, available_quantity)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  let addedBooks = 0;
  sampleBooks.forEach((book) => {
    insertBook.run(book, function(error) {
      if (error) {
        console.error(`Lỗi nạp sách mẫu ${book[0]}:`, error.message);
      } else if (this.changes > 0) {
        addedBooks += this.changes;
      }
    });
  });
  insertBook.finalize((error) => {
    if (error) {
      console.error('Lỗi hoàn tất nạp dữ liệu sách mẫu:', error.message);
    } else if (addedBooks > 0) {
      console.log(`Đã bổ sung ${addedBooks} sách mẫu vào thư viện.`);
    }
  });
});

module.exports = db;