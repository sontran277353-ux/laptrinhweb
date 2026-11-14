# Van Son Library

Website quản lý thư viện Văn Sơn Library.

## GitHub

[sontran277353-ux/laptrinhweb](https://github.com/sontran277353-ux/laptrinhweb)

## Cau truc du an

```text
van-son-library/
|-- .vscode/                 # Cấu hình VS Code
|-- node_modules/            # Các gói phụ thuộc npm
|-- database/
|   |-- db.js                # Khởi tạo và kết nối SQLite
|   `-- library.db           # Cơ sở dữ liệu thư viện
|-- docs/
|   `-- Tieu_luan_Mang_May_Tinh_Van_Son_Library.docx
|-- middleware/
|   `-- auth.js              # Xác thực token và quyền admin
|-- public/
|   |-- css/                 # CSS đã biên dịch
|   |-- js/                  # JavaScript giao diện và API
|   |-- scss/                # Mã nguồn SCSS
|   `-- index.html           # Trang giao diện chính
|-- server.js                # Express server và các API
|-- package.json             # Dependencies và npm scripts
|-- package-lock.json
`-- README.md
```

## Chạy local

Cần cài đặt Node.js và npm. Tại thư mục dự án, chạy:

```bash
npm install
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000) trong trình duyệt. Dừng server bằng `Ctrl+C`.

## Build CSS

```bash
npm run build:css
```
