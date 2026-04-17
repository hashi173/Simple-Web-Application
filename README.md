# 📚 StoryApp — Ứng dụng đọc truyện thực hành

## Chạy ứng dụng

```bash
node app.js
# Truy cập: http://localhost:3000
```

> Không cần cài thêm thư viện. Toàn bộ dùng Node.js built-in (`http`, `url`, `crypto`).

---

## Sơ đồ các Route

```
GET  /                   → Trang chủ (đọc cookie theme)
GET  /set-theme/:theme   → Lưu theme vào cookie (light | dark)
GET  /login              → Hiển thị form đăng nhập
POST /login              → Xử lý đăng nhập → tạo session
GET  /profile            → Trang cá nhân (yêu cầu đăng nhập)
GET  /logout             → Xóa session → đăng xuất
```

---

## Các khái niệm được thực hành

### 1. Routing (Định tuyến)

Thực hiện thủ công bằng cách kiểm tra `pathname` và `method` từ `http.IncomingMessage`:

```js
const parsedUrl = url.parse(req.url, true);
const pathname  = parsedUrl.pathname;   // "/profile"
const method    = req.method;           // "GET" | "POST"

if (method === "GET" && pathname === "/profile") { ... }
```

Route có tham số động (`:theme`) được xử lý bằng **Regex**:
```js
const themeMatch = pathname.match(/^\/set-theme\/([^/]+)$/);
// themeMatch[1] → "light" hoặc "dark"
```

---

### 2. Cookie

**Đọc cookie** từ header `Cookie`:
```
Cookie: theme=dark; session_id=abc123
        ↓ parseCookies(req)
{ theme: "dark", session_id: "abc123" }
```

**Ghi cookie** vào header `Set-Cookie`:
```
Set-Cookie: theme=dark; Max-Age=604800; Path=/
            ↑tên=giá trị  ↑thời gian sống(7ngày)
```

**Xóa cookie** bằng cách đặt `Max-Age=0`:
```
Set-Cookie: session_id=; Max-Age=0; Path=/
```

| Cookie        | Mục đích            | Max-Age       | HttpOnly |
|---------------|---------------------|---------------|----------|
| `theme`       | Lưu giao diện       | 7 ngày        | Không    |
| `session_id`  | Định danh phiên     | Theo phiên    | Có ✅    |

---

### 3. Session

Session là **dữ liệu phía server**, chỉ có `session_id` được gửi về client qua cookie.

```
CLIENT                          SERVER
  │── Cookie: session_id=xyz ──▶│
  │                              │ sessions["xyz"] = {
  │                              │   username: "alice",
  │                              │   loginTime: "...",
  │◀── HTML trang cá nhân ──────│   profileVisits: 3
                                 │ }
```

**Vòng đời session:**
1. `POST /login` thành công → `createSession()` → gửi `session_id` cookie
2. Mỗi request → `getSession(req)` đọc cookie → tra cứu `sessions[sid]`
3. `GET /logout` → `destroySession(sid)` → xóa khỏi bộ nhớ + xóa cookie

---

### 4. Kiểm soát truy cập (Access Control)

```js
// Trong handleProfile():
const session = getSession(req);
if (!session) {
  // Chưa đăng nhập → redirect về /login
  res.writeHead(302, { Location: "/login" });
  return res.end();
}
// Đã đăng nhập → tiếp tục xử lý
```

**Nguyên tắc:**  
Mỗi route cần bảo vệ phải tự kiểm tra session — không có "middleware" ở đây (nếu dùng Express thì đây là nơi dùng `middleware` xác thực).

---

### 5. Bộ đếm truy cập trong session

```js
// Tăng mỗi khi GET /profile được gọi
session.data.profileVisits = (session.data.profileVisits || 0) + 1;
```

- Dữ liệu nằm trong `sessions[sid]` trên **server**
- Tự động reset khi đăng xuất (session bị xóa)
- Tự động reset khi đóng trình duyệt (cookie `session_id` hết hiệu lực)

---

## Luồng hoạt động đầy đủ

```
Người dùng truy cập /
        │
        ├─ Có cookie theme? → Hiển thị giao diện đúng theme
        └─ Không? → Hiển thị light (mặc định)

Nhấn /set-theme/dark
        │
        └─ Set-Cookie: theme=dark; Max-Age=604800
           Redirect → /  (trang chủ đổi sang dark)

Nhấn Đăng nhập → GET /login → POST /login (username+password)
        │
        ├─ Sai → hiển thị lỗi, ở lại /login
        └─ Đúng → Tạo session → Set-Cookie: session_id=...
                  Redirect → /profile

GET /profile (đã đăng nhập)
        │
        └─ session.profileVisits++ → Hiển thị thông tin + số lần truy cập

GET /logout
        │
        └─ Xóa sessions[sid]
           Set-Cookie: session_id=; Max-Age=0
           Hiển thị trang "Đã đăng xuất"

GET /profile (sau logout)
        │
        └─ Không tìm thấy session → Redirect → /login
```

---

## Tài khoản thử nghiệm

| Username | Password |
|----------|----------|
| alice    | 1234     |
| bob      | abcd     |
| admin    | admin    |
