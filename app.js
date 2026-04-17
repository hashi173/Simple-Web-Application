/**
 * Ứng dụng đọc truyện đơn giản
 * Thực hành: Routing, Cookie, Session, Login, Access Control
 */

const http = require("http");
const url = require("url");
const crypto = require("crypto");

const PORT = 3000;

// App dùng dữ liệu tĩnh, lưu session trong bộ nhớ server (không dùng DB)
const VALID_USERS = {
  alice: "1234",
  bob: "abcd",
  admin: "admin",
};

const STORIES = [
  {
    id: 1,
    title: "Dế Mèn Phiêu Lưu Ký",
    author: "Tô Hoài",
    preview: "Dế Mèn trèo lên bờ đất phía trên hang...",
  },
  {
    id: 2,
    title: "Cho Tôi Xin Một Vé Đi Tuổi Thơ",
    author: "Nguyễn Nhật Ánh",
    preview: "Ngày xưa, hồi còn nhỏ, tôi sống trong một thị trấn nhỏ...",
  },
  {
    id: 3,
    title: "Tắt Đèn",
    author: "Ngô Tất Tố",
    preview: "Làng Đông Xá vào một buổi sáng sớm tháng tám...",
  },
];

// Quản lý session bằng object trong bộ nhớ server

const sessions = {}; // { sessionId: { username, loginTime, profileVisits, ... } }

function generateSessionId() {
  return crypto.randomBytes(24).toString("hex");
}

function getSession(req) {
  const cookies = parseCookies(req);
  const sid = cookies["session_id"];
  if (sid && sessions[sid]) {
    return { id: sid, data: sessions[sid] };
  }
  return null;
}

function createSession() {
  const sid = generateSessionId();
  sessions[sid] = {};
  return sid;
}

function destroySession(sid) {
  delete sessions[sid];
}

// Xử lý cookie

function parseCookies(req) {
  const cookieHeader = req.headers["cookie"] || "";
  const cookies = {};
  cookieHeader.split(";").forEach((part) => {
    const [key, ...rest] = part.trim().split("=");
    if (key) cookies[key.trim()] = decodeURIComponent(rest.join("="));
  });
  return cookies;
}

function setCookie(res, name, value, options = {}) {
  let cookie = `${name}=${encodeURIComponent(value)}`;
  if (options.maxAge) cookie += `; Max-Age=${options.maxAge}`;
  if (options.httpOnly) cookie += "; HttpOnly";
  if (options.path) cookie += `; Path=${options.path}`;
  else cookie += "; Path=/";
  const existing = res.getHeader("Set-Cookie") || [];
  const arr = Array.isArray(existing) ? existing : [existing];
  res.setHeader("Set-Cookie", [...arr, cookie]);
}

function deleteCookie(res, name) {
  const arr = res.getHeader("Set-Cookie") || [];
  const existing = Array.isArray(arr) ? arr : [arr];
  res.setHeader("Set-Cookie", [
    ...existing,
    `${name}=; Max-Age=0; Path=/`,
  ]);
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
  });
}

function parseFormBody(body) {
  const params = {};
  body.split("&").forEach((part) => {
    const [k, v] = part.split("=");
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || "");
  });
  return params;
}

// HTML layout

function layout(title, bodyHtml, theme = "light") {
  const isDark = theme === "dark";

  return `<!DOCTYPE html>
<html lang="vi" data-theme="${theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} — StoryApp</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Spectral+SC:wght@400;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }

    :root {
      --ink:   ${isDark ? "#e8e4dc" : "#111"};
      --paper: ${isDark ? "#111" : "#f9f7f4"};
      --dim:   ${isDark ? "rgba(232,228,220,.38)" : "rgba(17,17,17,.38)"};
      --rule:  ${isDark ? "rgba(232,228,220,.14)" : "rgba(17,17,17,.12)"};
      --hover: ${isDark ? "rgba(232,228,220,.06)" : "rgba(17,17,17,.04)"};
    }

    html { font-size:17px; }

    body {
      background: var(--paper);
      color: var(--ink);
      font-family: 'Spectral', Georgia, serif;
      font-weight: 300;
      line-height: 1.65;
      min-height: 100vh;
    }

    /* ── GRID ── */
    .wrap {
      max-width: 680px;
      margin: 0 auto;
      padding: 0 24px;
    }

    /* ── HEADER ── */
    header {
      border-bottom: 1px solid var(--rule);
      padding: 22px 0 18px;
      margin-bottom: 56px;
    }
    header .wrap {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    .site-name {
      font-family: 'Spectral SC', serif;
      font-size: .78rem;
      font-weight: 600;
      letter-spacing: .12em;
      text-transform: uppercase;
      text-decoration: none;
      color: var(--ink);
    }
    nav { display:flex; gap:28px; align-items:baseline; }
    nav a {
      font-size: .82rem;
      color: var(--dim);
      text-decoration: none;
      letter-spacing: .02em;
      transition: color .15s;
    }
    nav a:hover { color: var(--ink); }

    /* ── TYPOGRAPHY ── */
    h1 {
      font-size: 2rem;
      font-weight: 300;
      letter-spacing: -.02em;
      line-height: 1.2;
      margin-bottom: 8px;
    }
    h2 {
      font-size: 1.05rem;
      font-weight: 600;
      letter-spacing: .01em;
      margin-bottom: 12px;
    }
    .kicker {
      font-size: .78rem;
      font-family: 'Spectral SC', serif;
      letter-spacing: .1em;
      color: var(--dim);
      text-transform: uppercase;
      margin-bottom: 32px;
    }
    p { margin-bottom: 1em; }
    em { font-style: italic; }
    code {
      font-family: 'Courier New', monospace;
      font-size: .82em;
      opacity: .7;
    }

    /* ── LINKS ── */
    a { color: var(--ink); }
    .text-link {
      text-decoration: underline;
      text-decoration-color: var(--rule);
      text-underline-offset: 3px;
      transition: text-decoration-color .15s;
    }
    .text-link:hover { text-decoration-color: var(--ink); }

    /* ── DIVIDERS ── */
    hr {
      border: none;
      border-top: 1px solid var(--rule);
      margin: 40px 0;
    }

    /* ── STORY LIST ── */
    .story-list { list-style: none; }
    .story-item {
      border-top: 1px solid var(--rule);
      padding: 24px 0;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0 20px;
      align-items: start;
    }
    .story-item:last-child { border-bottom: 1px solid var(--rule); }
    .story-title {
      font-size: 1.08rem;
      font-weight: 400;
      margin-bottom: 3px;
    }
    .story-author {
      font-size: .8rem;
      color: var(--dim);
      letter-spacing: .03em;
    }
    .story-preview {
      font-size: .85rem;
      font-style: italic;
      color: var(--dim);
      margin-top: 8px;
      grid-column: 1 / -1;
    }
    .story-num {
      font-size: .75rem;
      font-family: 'Spectral SC', serif;
      color: var(--dim);
      padding-top: 4px;
    }

    /* ── FORM ── */
    .form-block { max-width: 380px; }
    .field { margin-bottom: 24px; }
    .field label {
      display: block;
      font-size: .78rem;
      font-family: 'Spectral SC', serif;
      letter-spacing: .1em;
      text-transform: uppercase;
      color: var(--dim);
      margin-bottom: 8px;
    }
    .field input {
      width: 100%;
      background: transparent;
      border: none;
      border-bottom: 1px solid var(--rule);
      color: var(--ink);
      font-family: 'Spectral', serif;
      font-size: 1rem;
      font-weight: 300;
      padding: 6px 0 10px;
      outline: none;
      transition: border-color .2s;
      -webkit-appearance: none;
    }
    .field input:focus { border-bottom-color: var(--ink); }
    .field input::placeholder { color: var(--dim); font-style: italic; }

    /* ── BUTTONS ── */
    .btn-primary {
      display: inline-block;
      background: var(--ink);
      color: var(--paper);
      font-family: 'Spectral SC', serif;
      font-size: .75rem;
      font-weight: 600;
      letter-spacing: .12em;
      text-transform: uppercase;
      text-decoration: none;
      padding: 11px 26px;
      border: none;
      cursor: pointer;
      transition: opacity .15s;
    }
    .btn-primary:hover { opacity: .8; }
    .btn-ghost {
      display: inline-block;
      background: transparent;
      color: var(--ink);
      font-family: 'Spectral SC', serif;
      font-size: .75rem;
      font-weight: 600;
      letter-spacing: .12em;
      text-transform: uppercase;
      text-decoration: none;
      padding: 10px 24px;
      border: 1px solid var(--rule);
      cursor: pointer;
      transition: border-color .15s;
    }
    .btn-ghost:hover { border-color: var(--ink); }

    /* ── PROFILE STATS ── */
    .stat-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1px;
      background: var(--rule);
      border: 1px solid var(--rule);
      margin: 32px 0;
    }
    .stat {
      background: var(--paper);
      padding: 20px;
    }
    .stat-label {
      font-size: .72rem;
      font-family: 'Spectral SC', serif;
      letter-spacing: .1em;
      text-transform: uppercase;
      color: var(--dim);
      display: block;
      margin-bottom: 6px;
    }
    .stat-value {
      font-size: 1.15rem;
      font-weight: 300;
    }

    /* ── NOTICE / ERROR ── */
    .notice {
      font-size: .85rem;
      color: var(--dim);
      border-left: 2px solid var(--rule);
      padding-left: 14px;
      margin-bottom: 28px;
      font-style: italic;
    }
    .notice.is-error {
      border-left-color: var(--ink);
      color: var(--ink);
    }

    /* ── HINT ── */
    .hint {
      font-size: .78rem;
      color: var(--dim);
      margin-top: 16px;
    }

    /* ── FOOTER ── */
    footer {
      border-top: 1px solid var(--rule);
      padding: 24px 0;
      margin-top: 80px;
    }
    footer .wrap {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .footer-note {
      font-size: .75rem;
      color: var(--dim);
      letter-spacing: .03em;
    }
  </style>
</head>
<body>

<header>
  <div class="wrap">
    <a href="/" class="site-name">StoryApp</a>
    <nav id="main-nav"></nav>
  </div>
</header>

${bodyHtml}

<footer>
  <div class="wrap">
    <span class="footer-note">StoryApp</span>
    <span class="footer-note">Giao diện: ${isDark ? "tối" : "sáng"} &middot; <a href="/set-theme/${isDark ? "light" : "dark"}" class="text-link">${isDark ? "chuyển sáng" : "chuyển tối"}</a></span>
  </div>
</footer>

</body>
</html>`;
}

// Handler cho từng route

/** GET / — Trang chủ */
function handleHome(req, res) {
  const cookies = parseCookies(req);
  const theme = cookies["theme"] === "dark" ? "dark" : "light";
  const session = getSession(req);

  const storyItems = STORIES.map(
    (s, i) => `
    <li class="story-item">
      <div>
        <div class="story-title">${s.title}</div>
        <div class="story-author">${s.author}</div>
        <div class="story-preview">${s.preview}</div>
      </div>
      <span class="story-num">${String(i + 1).padStart(2, "0")}</span>
    </li>`
  ).join("");

  const navLinks = session
    ? `<a href="/profile">Trang cá nhân</a><a href="/logout">Đăng xuất</a>`
    : `<a href="/login">Đăng nhập</a>`;

  const body = `
  <script>
    document.getElementById('main-nav').innerHTML = \`${navLinks}\`;
  </script>
  <main class="wrap">
    <p class="kicker">Thư viện</p>
    <h1>Danh sách truyện</h1>
    <p style="color:var(--dim);font-size:.9rem;margin-bottom:40px;">
      ${session ? `Xin chào, <em>${session.data.username}</em>.` : "Đăng nhập để theo dõi lịch sử đọc."}
    </p>
    <ul class="story-list">
      ${storyItems}
    </ul>
  </main>`;

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(layout("Trang chủ", body, theme));
}

/** GET /set-theme/:theme — Lưu theme vào cookie */
function handleSetTheme(req, res, theme) {
  const validThemes = ["light", "dark"];

  if (!validThemes.includes(theme)) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
    const cookies = parseCookies(req);
    const currentTheme = cookies["theme"] === "dark" ? "dark" : "light";
    const body = `
    <script>document.getElementById('main-nav').innerHTML='<a href="/">Trang chủ</a>';</script>
    <main class="wrap">
      <p class="kicker">Lỗi</p>
      <h1>Giao diện không hợp lệ</h1>
      <p class="notice is-error" style="margin-top:24px;">
        Giá trị "<code>${theme}</code>" không được chấp nhận. Chỉ dùng <code>light</code> hoặc <code>dark</code>.
      </p>
      <a href="/" class="btn-ghost">Quay về</a>
    </main>`;
    return res.end(layout("Lỗi theme", body, currentTheme));
  }

  setCookie(res, "theme", theme, { maxAge: 7 * 24 * 60 * 60 });
  res.writeHead(302, { Location: "/" });
  res.end();
}

/** GET /login — Form đăng nhập */
function handleLoginGet(req, res, errorMsg = "") {
  const cookies = parseCookies(req);
  const theme = cookies["theme"] === "dark" ? "dark" : "light";
  const session = getSession(req);

  if (session) {
    res.writeHead(302, { Location: "/profile" });
    return res.end();
  }

  const errorHtml = errorMsg
    ? `<p class="notice is-error">${errorMsg}</p>`
    : "";

  const body = `
  <script>document.getElementById('main-nav').innerHTML='<a href="/">Trang chủ</a>';</script>
  <main class="wrap">
    <p class="kicker">Tài khoản</p>
    <h1>Đăng nhập</h1>
    <p style="color:var(--dim);font-size:.9rem;margin:8px 0 40px;">Nhập thông tin để tiếp tục.</p>

    ${errorHtml}

    <div class="form-block">
      <form method="POST" action="/login">
        <div class="field">
          <label for="username">Tên đăng nhập</label>
          <input id="username" name="username" type="text" placeholder="alice, bob, admin" required autofocus>
        </div>
        <div class="field">
          <label for="password">Mật khẩu</label>
          <input id="password" name="password" type="password" placeholder="••••••" required>
        </div>
        <button type="submit" class="btn-primary">Đăng nhập</button>
      </form>
      <p class="hint">Tài khoản thử: alice / 1234 &middot; bob / abcd &middot; admin / admin</p>
    </div>
  </main>`;

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(layout("Đăng nhập", body, theme));
}

/** POST /login — Xử lý đăng nhập */
async function handleLoginPost(req, res) {
  const cookies = parseCookies(req);
  const theme = cookies["theme"] === "dark" ? "dark" : "light";

  const bodyText = await readBody(req);
  const { username = "", password = "" } = parseFormBody(bodyText);

  const trimmedUser = username.trim().toLowerCase();
  const trimmedPass = password.trim();

  // Kiểm tra thông tin đăng nhập
  if (!VALID_USERS[trimmedUser] || VALID_USERS[trimmedUser] !== trimmedPass) {
    return handleLoginGet(req, res, "Sai tên đăng nhập hoặc mật khẩu.");
  }

  // Tạo session mới
  const sid = createSession();
  sessions[sid] = {
    username: trimmedUser,
    loginTime: new Date().toISOString(),
    profileVisits: 0,
  };

  // Gửi cookie session (HttpOnly, hết phiên trình duyệt thì hết hiệu lực)
  setCookie(res, "session_id", sid, { httpOnly: true });

  res.writeHead(302, { Location: "/profile" });
  res.end();
}

/** GET /profile — Trang cá nhân (yêu cầu đăng nhập) */
function handleProfile(req, res) {
  const cookies = parseCookies(req);
  const theme = cookies["theme"] === "dark" ? "dark" : "light";
  const session = getSession(req);

  if (!session) {
    res.writeHead(302, { Location: "/login" });
    return res.end();
  }

  session.data.profileVisits = (session.data.profileVisits || 0) + 1;

  const loginDate = new Date(session.data.loginTime);
  const loginFormatted = loginDate.toLocaleString("vi-VN", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  });

  const visits = session.data.profileVisits;
  const visitMsg =
    visits === 1
      ? "Lần đầu tiên trong phiên này."
      : `Lần thứ ${visits} trong phiên này.`;

  const body = `
  <script>document.getElementById('main-nav').innerHTML='<a href="/">Trang chủ</a><a href="/logout">Đăng xuất</a>';</script>
  <main class="wrap">
    <p class="kicker">Tài khoản</p>
    <h1>${session.data.username}</h1>
    <p style="color:var(--dim);font-size:.9rem;margin:8px 0 40px;">
      Phiên làm việc đang hoạt động.
    </p>

    <div class="stat-row">
      <div class="stat">
        <span class="stat-label">Người dùng</span>
        <span class="stat-value">${session.data.username}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Đăng nhập lúc</span>
        <span class="stat-value" style="font-size:.9rem;">${loginFormatted}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Lượt xem trang</span>
        <span class="stat-value">${visits}</span>
      </div>
    </div>

    <p class="notice">${visitMsg} Bộ đếm sẽ reset khi đăng xuất.</p>

    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:32px;">
      <a href="/profile" class="btn-ghost">Tải lại trang</a>
      <a href="/logout" class="btn-primary">Đăng xuất</a>
    </div>
  </main>`;

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(layout("Trang cá nhân", body, theme));
}

/** GET /logout — Đăng xuất và xóa session */
function handleLogout(req, res) {
  const session = getSession(req);
  if (session) destroySession(session.id);
  deleteCookie(res, "session_id");

  const cookies = parseCookies(req);
  const theme = cookies["theme"] === "dark" ? "dark" : "light";

  const body = `
  <script>document.getElementById('main-nav').innerHTML='<a href="/">Trang chủ</a>';</script>
  <main class="wrap">
    <p class="kicker">Phiên kết thúc</p>
    <h1>Đã đăng xuất</h1>
    <p style="color:var(--dim);font-size:.9rem;margin:8px 0 40px;">
      Session đã bị xóa hoàn toàn. Hẹn gặp lại.
    </p>
    <hr>
    <div style="display:flex;gap:12px;margin-top:32px;">
      <a href="/login" class="btn-primary">Đăng nhập lại</a>
      <a href="/" class="btn-ghost">Về trang chủ</a>
    </div>
  </main>`;

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(layout("Đăng xuất", body, theme));
}

/** 404 — Không tìm thấy route */
function handle404(req, res) {
  const cookies = parseCookies(req);
  const theme = cookies["theme"] === "dark" ? "dark" : "light";

  const body = `
  <script>document.getElementById('main-nav').innerHTML='<a href="/">Trang chủ</a>';</script>
  <main class="wrap">
    <p class="kicker">404</p>
    <h1>Không tìm thấy</h1>
    <p style="color:var(--dim);font-size:.9rem;margin:8px 0 40px;">
      Route <code>${req.url}</code> không tồn tại.
    </p>
    <a href="/" class="btn-ghost">Về trang chủ</a>
  </main>`;

  res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
  res.end(layout("404", body, theme));
}

// Router chính

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  console.log(`[${new Date().toISOString()}] ${method} ${pathname}`);

  // --- GET / ---
  if (method === "GET" && pathname === "/") {
    return handleHome(req, res);
  }

  // --- GET /set-theme/:theme ---
  const themeMatch = pathname.match(/^\/set-theme\/([^/]+)$/);
  if (method === "GET" && themeMatch) {
    return handleSetTheme(req, res, themeMatch[1]);
  }

  // --- GET /login ---
  if (method === "GET" && pathname === "/login") {
    return handleLoginGet(req, res);
  }

  // --- POST /login ---
  if (method === "POST" && pathname === "/login") {
    return handleLoginPost(req, res);
  }

  // --- GET /profile ---
  if (method === "GET" && pathname === "/profile") {
    return handleProfile(req, res);
  }

  // --- GET /logout ---
  if (method === "GET" && pathname === "/logout") {
    return handleLogout(req, res);
  }

  // --- 404 ---
  return handle404(req, res);
});

server.listen(PORT, () => {
  console.log(`

StoryApp đang chạy
http://localhost:${PORT}            
Routes:
GET  /                  Trang chủ
GET  /login             Form login
POST /login             Xử lý login
GET  /profile           Trang cá nhân
GET  /logout            Đăng xuất
GET  /set-theme/:theme  Đổi giao diện
`);
});
