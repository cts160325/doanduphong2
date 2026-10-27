# Thư viện Mộc — Mộc Library

Website thư viện **đầy đủ backend + frontend**: tra cứu kho sách, mượn/trả, đặt trước,
đánh giá, phí phạt, kèm **bảng quản trị** cho thủ thư. Toàn bộ giao diện **song ngữ
Tiếng Việt / English** (nút VI·EN ở góc trên bên phải).

Built with Node.js + Express + SQLite (no build step, no frontend framework).

---

## Chạy nhanh / Quick start

```bash
npm install        # cài dependency (express, better-sqlite3)
npm start          # chạy server tại http://127.0.0.1:4310
```

Database tự được tạo và seed dữ liệu mẫu ở lần chạy đầu. Muốn seed lại từ đầu:

```bash
npm run seed       # xoá & tạo lại database với dữ liệu mẫu sạch
```

### Tài khoản dùng thử

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| Quản trị viên (thủ thư) | `admin@thuvien.vn` | `admin123` |
| Độc giả | `minhanh@example.com` | `member123` |

Email khác dùng chung mật khẩu `member123`: `hoangbao@example.com`, `thuha@example.com` (tạm khoá),
`quochuy@example.com`, `gialinh@example.com`.

---

## Chức năng / Features

**Độc giả**

- Trang chủ: tìm kiếm nhanh, sách nổi bật, 8 danh mục, sách mới, bảng xếp hạng được mượn nhiều
- Kho sách: tìm theo tên/tác giả/ISBN, lọc theo danh mục · ngôn ngữ · tình trạng, sắp xếp, phân trang
- Chi tiết sách: bìa sách, tình trạng bản sao, quy định mượn, tab Giới thiệu / Đánh giá / Thông tin, sách liên quan
- Mượn sách (14 ngày, tối đa 5 cuốn), **đặt trước** khi hết bản sao, theo dõi thứ tự hàng chờ,
  nhận sách khi tới lượt, gia hạn tối đa 2 lần (+7 ngày), trả sách
- Phí phạt: 5.000 ₫/ngày quá hạn, hiển thị trực tiếp, thanh toán trong trang tài khoản
- Đánh giá & sao (1–5, mỗi sách 1 đánh giá, sửa/xoá được), danh sách yêu thích, hồ sơ cá nhân, đổi mật khẩu
- Đăng nhập/đăng ký bằng cookie phiên (HttpOnly, HMAC-SHA256), mật khẩu hash bằng `scrypt`

**Quản trị viên (bảng điều khiển tối màu)**

- Tổng quan: thống kê kho sách/thành viên/mượn trả/phí phạt, biểu đồ 6 tháng, top mượn nhiều, phiếu gần đây
- CRUD sách (đủ 17 trường, chọn bộ màu bìa, đánh dấu nổi bật, khoá xoá khi đã có lịch sử mượn)
- Danh mục: thêm/sửa/xoá (tự động chặn khi còn đầu sách)
- Thành viên: tìm kiếm, sửa thông tin, tạm khoá/mở khoá, cấp/thu quyền quản trị (có bảo vệ “admin cuối cùng”)
- Phiếu mượn: lọc Tất cả/Đang mượn/Quá hạn/Đã trả/Có phí chưa thu, tạo phiếu mượn giúp độc giả, nhận trả, gia hạn
- Đặt trước: hàng chờ theo thứ tự, **cho mượn khi bản sách sẵn sàng**, huỷ phiếu
- Phí phạt: lọc Chưa thu/Đang phát sinh/Đã thanh toán/Đã miễn, thu tiền hoặc miễn

**Quy tắc nghiệp vụ (server)**

| Quy tắc | Giá trị |
| --- | --- |
| Thời hạn mượn | 14 ngày |
| Giới hạn cùng lúc | 5 cuốn |
| Gia hạn | +7 ngày, tối đa 2 lần, không được quá hạn, không khi có người chờ |
| Phí quá hạn | 5.000 ₫/ngày (chốt khi trả sách) |
| Giữ sách đặt trước | 48 giờ, tự hết hạn và nhường bản sách cho người kế tiếp |
| Bản sách sẵn sàng | `total − phiếu mượn đang mở − bản đang giữ cho đặt trước` (đồng bộ sau mọi thao tác) |

---

## API

```
GET    /api/health
GET    /api/stats · /api/categories · /api/books · /api/books/:slug

POST   /api/auth/register · /api/auth/login · /api/auth/logout
GET    /api/auth/me
PATCH  /api/auth/profile          POST /api/auth/password

POST   /api/books/:id/reviews     DELETE /api/reviews/:id
GET    /api/favorites             POST/DELETE /api/favorites/:bookId

GET    /api/account/overview · /api/account/loans · /api/account/reservations · /api/account/fines
POST   /api/account/loans · /api/account/loans/:id/renew · /api/account/loans/:id/return
POST   /api/account/reservations  DELETE /api/account/reservations/:id
POST   /api/account/fines/:loanId/pay

GET    /api/admin/overview · /books · /categories · /members · /loans · /reservations · /fines
POST   /api/admin/books · /api/admin/loans · /api/admin/categories
PATCH  /api/admin/books/:id · /api/admin/members/:id · /api/admin/categories/:id
DELETE /api/admin/books/:id · /api/admin/categories/:id
POST   /api/admin/loans/:id/return · /api/admin/loans/:id/renew
POST   /api/admin/reservations/:id/fulfill · /api/admin/reservations/:id/cancel
POST   /api/admin/fines/:loanId/pay · /api/admin/fines/:loanId/waive
```

Lỗi trả về dạng `{ "error": "CODE" }`, frontend dịch mã lỗi sang ngôn ngữ đang chọn
(`server/lib/library.js` → `public/js/i18n.js`).

---

## Cấu trúc dự án

```
server/
  index.js            Express app: middleware phiên, routes, static, error handler
  db.js               kết nối SQLite (WAL) + schema
  seed.js             dữ liệu mẫu: 31 đầu sách, 6 tài khoản, phiếu mượn/đặt trước/đánh giá
  lib/auth.js          hash scrypt + cookie phiên HMAC
  lib/library.js       quy tắc mượn trả, đặt trước, phí phạt, đồng bộ tồn kho
  lib/queries.js       truy vấn sách / phiếu mượn / đặt trước dùng chung
  routes/auth.js       đăng ký, đăng nhập, hồ sơ, đổi mật khẩu
  routes/books.js      kho sách, chi tiết, đánh giá, yêu thích
  routes/account.js    mượn, gia hạn, trả, đặt trước, phí phạt (độc giả)
  routes/admin.js      bảng quản trị (yêu cầu quyền admin)
public/
  index.html           shell SPA
  css/styles.css       hệ thống thiết kế (giấy · mực · đất nung)
  js/app.js            router hash, header, footer, guard
  js/i18n.js           từ điển VI/EN + định dạng tiền/ngày
  js/api.js · store.js · ui.js
  js/pages/            home · catalog · book · auth · account · admin
data/library.db        database SQLite (tự sinh, không commit)
```

---

## Ghi chú

- Chạy được trên Node.js ≥ 18 (`express` + `better-sqlite3`, không cần build).
- Dữ liệu lưu trong `data/library.db`; xoá thư mục `data/` và chạy lại `npm run seed` để làm mới.
- Đây là dự án demo: giao dịch thanh toán phí phạt là mô phỏng, không gắn thẻ thật.
