const fs = require('node:fs');
const path = require('node:path');
const { hashPassword } = require('./lib/auth');

const DAY = 86400000;
const iso = (msAgo = 0) => new Date(Date.now() - msAgo).toISOString();
const daysAgo = (n) => iso(n * DAY);
const daysAhead = (n) => iso(-n * DAY);

const CATEGORIES = [
  ['van-hoc', 'Văn học', 'Literature'],
  ['kinh-te', 'Kinh tế', 'Business & Economics'],
  ['khoa-hoc', 'Khoa học', 'Science'],
  ['lich-su', 'Lịch sử', 'History'],
  ['ky-nang', 'Kỹ năng', 'Self-help'],
  ['thieu-nhi', 'Thiếu nhi', "Children's"],
  ['cong-nghe', 'Công nghệ', 'Technology'],
  ['triet-hoc', 'Triết học', 'Philosophy'],
];

const BOOKS = [
  ['so-do', 'Số đỏ', 'Vũ Trọng Phụng', 'van-hoc', 1936, 'NXB Văn học', 'vi', 220, 3, 1, 'A-VH-01',
    'Tiểu thuyết châm biếm bậc thầy về xã hội Hà Nội nửa Tây nửa ta những năm 1930, qua hành trình của Xuân Tóc Đỏ.',
    'A masterful satire of 1930s Hanoi society, following the improbable rise of Xuan Toc Do.'],
  ['chi-pheo', 'Chí Phèo', 'Nam Cao', 'van-hoc', 1941, 'NXB Văn học', 'vi', 160, 2, 0, 'A-VH-02',
    'Truyện ngắn kinh điển về bi kịch tha hoá của người nông dân nghèo, một trong những đỉnh cao của văn học hiện thực Việt Nam.',
    'A landmark short story about the tragedy of a poor farmer in rural Vietnam.'],
  ['truyen-kieu', 'Truyện Kiều', 'Nguyễn Du', 'van-hoc', 1820, 'NXB Trẻ', 'vi', 320, 2, 0, 'A-VH-03',
    'Kiệt tác thơ Nôm kể về cuộc đời Thuý Kiều, biểu tượng của văn học cổ điển Việt Nam.',
    'The great Vietnamese verse epic following the life of Thuy Kieu.'],
  ['tat-den', 'Tắt đèn', 'Ngô Tất Tố', 'van-hoc', 1939, 'NXB Văn học', 'vi', 244, 2, 0, 'A-VH-04',
    'Bức tranh chân thực về người nông dân dưới ách sưu thuế, nổi bật với hình tượng chị Dậu.',
    'A vivid portrait of peasant life under colonial taxation, centred on Chi Dau.'],
  ['mat-biec', 'Mắt biếc', 'Nguyễn Nhật Ánh', 'van-hoc', 1990, 'NXB Trẻ', 'vi', 280, 3, 0, 'A-VH-05',
    'Chuyện tình tuổi học trò trong trẻo và day dứt giữa Ngạn và Hà Lan, được nhiều thế hệ độc giả yêu mến.',
    'A tender coming-of-age love story that has moved generations of readers.'],
  ['rung-na-uy', 'Rừng Na Uy', 'Haruki Murakami', 'van-hoc', 1987, 'NXB Hội Nhà văn', 'vi', 424, 2, 0, 'A-VH-06',
    'Tiểu thuyết về tình yêu, mất mát và ký ức tuổi trẻ, lấy bối cảnh Tokyo những năm 1960.',
    "Murakami's novel of love, loss and memory set in 1960s Tokyo."],
  ['nha-gia-kim', 'Nhà giả kim', 'Paulo Coelho', 'van-hoc', 1988, 'NXB Hội Nhà văn', 'vi', 228, 1, 1, 'A-VH-07',
    'Hành trình của cậu bé Santiago đi tìm kho báu và khám phá vận mệnh của chính mình.',
    "Santiago's journey in search of treasure becomes a discovery of his own destiny."],
  ['1984', '1984', 'George Orwell', 'van-hoc', 1949, 'NXB Hội Nhà văn', 'vi', 328, 1, 0, 'A-VH-08',
    'Tiểu thuyết phản địa đàng về một nhà nước toàn trị, nơi tư duy bị kiểm soát và sự thật bị bóp méo.',
    "Orwell's dystopian classic about totalitarian control and the manipulation of truth."],
  ['suoi-nguon', 'Suối nguồn', 'Ayn Rand', 'van-hoc', 1943, 'NXB Trẻ', 'vi', 1180, 1, 0, 'A-VH-09',
    'Tiểu thuyết về cá nhân sáng tạo và sự đối đầu giữa tư duy độc lập với áp lực tập thể.',
    "A novel of creative independence versus collective conformity."],
  ['dac-nhan-tam', 'Đắc nhân tâm', 'Dale Carnegie', 'ky-nang', 1936, 'NXB Tổng hợp', 'vi', 320, 4, 1, 'B-KN-01',
    'Nghệ thuật giao tiếp và ứng xử con người qua những nguyên tắc thực tiễn đã được kiểm chứng gần một thế kỷ.',
    'Timeless principles of human relations and communication.'],
  ['thoi-quen-nguyen-tu', 'Thói quen nguyên tử', 'James Clear', 'ky-nang', 2018, 'NXB Lao động', 'vi', 336, 3, 1, 'B-KN-02',
    'Cách xây dựng thói quen nhỏ tạo ra thay đổi lớn, dựa trên khoa học hành vi và hệ thống.',
    'How tiny habits compound into remarkable results, grounded in behavioural science.'],
  ['tu-duy-nhanh-va-cham', 'Tư duy nhanh và chậm', 'Daniel Kahneman', 'ky-nang', 2011, 'NXB Thế giới', 'vi', 588, 2, 0, 'B-KN-03',
    'Khám phá hai hệ thống tư duy chi phối quyết định của con người, từ nhà tâm lý học đoạt giải Nobel.',
    "A Nobel laureate's exploration of the two systems that shape human judgement."],
  ['sapiens', 'Sapiens: Lược sử loài người', 'Yuval Noah Harari', 'lich-su', 2011, 'NXB Tri thức', 'vi', 560, 2, 1, 'C-LS-01',
    'Hành trình 70.000 năm của loài người, từ cách mạng nhận thức đến khoa học và công nghệ.',
    'Seventy thousand years of human history, from cognition to science and technology.'],
  ['homo-deus', 'Homo Deus: Lược sử tương lai', 'Yuval Noah Harari', 'lich-su', 2016, 'NXB Tri thức', 'vi', 512, 1, 0, 'C-LS-02',
    'Dự báo về tương lai loài người khi công nghệ, dữ liệu và trí tuệ nhân tạo định hình lại xã hội.',
    "A provocative look at humanity's future shaped by data, AI and biotechnology."],
  ['viet-nam-su-luoc', 'Việt Nam sử lược', 'Trần Trọng Kim', 'lich-su', 1920, 'NXB Văn học', 'vi', 620, 2, 0, 'C-LS-03',
    'Cái nhìn hệ thống về lịch sử Việt Nam từ thời dựng nước đến đầu thế kỷ XX.',
    'A concise, systematic history of Vietnam from its founding to the early 20th century.'],
  ['lich-su-viet-nam-bang-tranh', 'Lịch sử Việt Nam bằng tranh', 'Trần Bạch Đằng', 'lich-su', 1997, 'NXB Trẻ', 'vi', 96, 3, 0, 'C-LS-04',
    'Lịch sử dân tộc kể bằng tranh sinh động, dễ tiếp cận cho độc giả trẻ.',
    "Vietnam's history told through lively illustrations for younger readers."],
  ['kinh-te-vi-mo', 'Kinh tế học vĩ mô', 'N. Gregory Mankiw', 'kinh-te', 2020, 'NXB Kinh tế', 'vi', 640, 2, 0, 'D-KT-01',
    'Giáo trình kinh tế vĩ mô hiện đại với ví dụ thực tiễn, phù hợp sinh viên và người tự học.',
    'A modern macroeconomics textbook with real-world examples for students and self-learners.'],
  ['chien-luoc-dai-duong-xanh', 'Chiến lược đại dương xanh', 'W. Chan Kim & Renée Mauborgne', 'kinh-te', 2005, 'NXB Lao động', 'vi', 400, 2, 0, 'D-KT-02',
    'Chiến lược tạo không gian thị trường mới thay vì cạnh tranh trong đại dương đỏ đẫm máu.',
    'A strategy for creating uncontested market space instead of fighting in the red ocean.'],
  ['dau-tu-thong-minh', 'Đầu tư thông minh', 'Benjamin Graham', 'kinh-te', 1949, 'NXB Thế giới', 'vi', 640, 1, 0, 'D-KT-03',
    'Kinh điển về đầu tư giá trị, nguyên tắc an toàn biên và tư duy dài hạn của nhà đầu tư.',
    'The classic guide to value investing, margin of safety and long-term discipline.'],
  ['khoi-nghiep-tinh-gon', 'Khởi nghiệp tinh gọn', 'Eric Ries', 'kinh-te', 2011, 'NXB Lao động', 'vi', 384, 2, 0, 'D-KT-04',
    'Phương pháp xây dựng sản phẩm, thử nghiệm nhanh và học từ dữ liệu thay vì kế hoạch cứng nhắc.',
    'Build, measure, learn: a method for launching startups with fast feedback loops.'],
  ['luoc-su-thoi-gian', 'Lược sử thời gian', 'Stephen Hawking', 'khoa-hoc', 1988, 'NXB Trẻ', 'vi', 256, 2, 0, 'E-KH-01',
    'Từ vụ nổ lớn đến lỗ đen: lịch sử vũ trụ được giải thích cho mọi độc giả.',
    'From the Big Bang to black holes: the story of the universe, clearly told.'],
  ['vu-tru-trong-vo-hat-de', 'Vũ trụ trong vỏ hạt dẻ', 'Stephen Hawking', 'khoa-hoc', 2001, 'NXB Trẻ', 'vi', 216, 1, 0, 'E-KH-02',
    'Những câu hỏi lớn nhất về vũ trụ, vật lý lượng tử và thuyết M.',
    "The universe's biggest questions, quantum physics and M-theory in one volume."],
  ['bo-gen', 'Bộ gen', 'Matt Ridley', 'khoa-hoc', 1999, 'NXB Tri thức', 'vi', 448, 1, 0, 'E-KH-03',
    'Hành trình khám phá bộ gen người và những ảnh hưởng của nó tới sức khoẻ, tính cách, xã hội.',
    'A journey through the human genome and its influence on health, character and society.'],
  ['clean-code', 'Clean Code', 'Robert C. Martin', 'cong-nghe', 2008, 'NXB Công nghệ', 'en', 464, 2, 1, 'F-CN-01',
    'Nguyên tắc viết mã sạch, dễ đọc và dễ bảo trì, dành cho mọi lập trình viên.',
    'Principles for writing clean, readable and maintainable code, for every developer.'],
  ['javascript-good-parts', 'JavaScript: The Good Parts', 'Douglas Crockford', 'cong-nghe', 2008, 'O’Reilly Media', 'en', 176, 2, 0, 'F-CN-02',
    'Cái nhìn sâu sắc về những phần tinh tuý và cạm bẫy của JavaScript.',
    "An incisive guide to JavaScript's elegant core and its pitfalls."],
  ['thiet-ke-he-thong-du-lieu', 'Thiết kế hệ thống dữ liệu quy mô lớn', 'Martin Kleppmann', 'cong-nghe', 2017, 'NXB Công nghệ', 'vi', 616, 1, 0, 'F-CN-03',
    'Nền tảng về hệ thống dữ liệu phân tán: lưu trữ, nhân bản, phân vùng và nhất quán.',
    'The foundations of distributed data systems: storage, replication, partitioning and consistency.'],
  ['de-men', 'Dế Mèn phiêu lưu ký', 'Tô Hoài', 'thieu-nhi', 1941, 'NXB Kim Đồng', 'vi', 200, 2, 1, 'G-TN-01',
    'Nhật ký phiêu lưu của chú Dế Mèn qua thế giới loài vật, giàu bài học về lòng dũng cảm.',
    "The adventures of a brave cricket in the animal world, a beloved Vietnamese children's classic."],
  ['hoang-tu-be', 'Hoàng tử bé', 'Antoine de Saint-Exupéry', 'thieu-nhi', 1943, 'NXB Hội Nhà văn', 'vi', 120, 3, 0, 'G-TN-02',
    'Câu chuyện thơ mộng về tình bạn, trách nhiệm và điều gì thật sự quan trọng.',
    'A poetic tale of friendship, responsibility and what truly matters.'],
  ['harry-potter', 'Harry Potter và Hòn đá phù thủy', 'J.K. Rowling', 'thieu-nhi', 1997, 'NXB Trẻ', 'vi', 360, 3, 0, 'G-TN-03',
    'Khởi đầu của cậu bé phù thuỷ Harry Potter tại trường Hogwarts huyền diệu.',
    'The first year of Harry Potter at the magical Hogwarts School.'],
  ['nghe-thuat-tu-duy-ro-rang', 'Nghệ thuật tư duy rõ ràng', 'Rolf Dobelli', 'triet-hoc', 2011, 'NXB Thế giới', 'vi', 360, 2, 0, 'H-TH-01',
    '99 lỗi tư duy thường gặp và cách nhận diện để ra quyết định sáng suốt hơn.',
    'Ninety-nine thinking traps and how to spot them for clearer decisions.'],
  ['mot-doi-tim-y-nghia', 'Một đời tìm ý nghĩa', 'Viktor E. Frankl', 'triet-hoc', 1946, 'NXB Lao động', 'vi', 200, 2, 0, 'H-TH-02',
    'Hồi ký từ trại tập trung và triết lý logotherapy về ý nghĩa sống của con người.',
    'A concentration-camp memoir and the logotherapy philosophy of finding meaning.'],
];

const USERS = [
  ['Quản trị viên', 'admin@thuvien.vn', 'admin123', 'admin', 'active', '0901 234 567', '12 Nguyễn Du, Quận 1, TP.HCM'],
  ['Nguyễn Minh Anh', 'minhanh@example.com', 'member123', 'member', 'active', '0902 345 678', '45 Lý Tự Trọng, Quận 1, TP.HCM'],
  ['Trần Hoàng Bảo', 'hoangbao@example.com', 'member123', 'member', 'active', '0903 456 789', '88 Nguyễn Trãi, Quận 5, TP.HCM'],
  ['Lê Thu Hà', 'thuha@example.com', 'member123', 'member', 'suspended', '0904 567 890', '21 Trần Hưng Đạo, Quận 1, TP.HCM'],
  ['Phạm Quốc Huy', 'quochuy@example.com', 'member123', 'member', 'active', '0905 678 901', '9 Phan Xích Long, Phú Nhuận, TP.HCM'],
  ['Đỗ Gia Linh', 'gialinh@example.com', 'member123', 'member', 'active', '0906 789 012', '150 Võ Văn Tần, Quận 3, TP.HCM'],
];

function seedDatabase(db) {
  const insertCategory = db.prepare('INSERT INTO categories (slug, name_vi, name_en) VALUES (?, ?, ?)');
  const catIds = new Map();
  const seedAll = db.transaction(() => {
    for (const [slug, vi, en] of CATEGORIES) {
      const info = insertCategory.run(slug, vi, en);
      catIds.set(slug, info.lastInsertRowid);
    }

    const insertBook = db.prepare(
      `INSERT INTO books (slug, title, author, isbn, publisher, year, category_id, language, pages,
        description_vi, description_en, cover_tone, total_copies, available_copies, shelf, featured, created_at)
       VALUES (@slug, @title, @author, @isbn, @publisher, @year, @category_id, @language, @pages,
        @description_vi, @description_en, @cover_tone, @total_copies, @available_copies, @shelf, @featured, @created_at)`
    );
    const bookIds = new Map();
    BOOKS.forEach((row, index) => {
      const [slug, title, author, cat, year, publisher, language, pages, copies, featured, shelf, vi, en] = row;
      const isbn = `978-604-${String(1000 + index).padStart(4, '0')}-${(index % 9) + 1}`;
      const info = insertBook.run({
        slug,
        title,
        author,
        isbn,
        publisher,
        year,
        category_id: catIds.get(cat),
        language,
        pages,
        description_vi: vi,
        description_en: en,
        cover_tone: index % 8,
        total_copies: copies,
        available_copies: copies,
        shelf,
        featured,
        created_at: daysAgo(120 - index * 2),
      });
      bookIds.set(slug, Number(info.lastInsertRowid));
    });

    const insertUser = db.prepare(
      'INSERT INTO users (name, email, password_hash, role, status, phone, address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const userIds = [];
    USERS.forEach(([name, email, password, role, status, phone, address], i) => {
      const info = insertUser.run(name, email, hashPassword(password), role, status, phone, address, daysAgo(200 - i * 12));
      userIds.push(Number(info.lastInsertRowid));
    });
    const [admin, minhanh, hoangbao, thuha, quochuy, gialinh] = userIds;

    const insertLoan = db.prepare(
      `INSERT INTO loans (user_id, book_id, borrowed_at, due_at, returned_at, renewed_count, fine_amount, fine_status, status, settled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const loan = (userId, slug, borrowedDaysAgo, dueDaysFromNow, opts = {}) => {
      const borrowed = daysAgo(borrowedDaysAgo);
      const due = daysAhead(dueDaysFromNow);
      insertLoan.run(
        userId,
        bookIds.get(slug),
        borrowed,
        due,
        opts.returnedDaysAgo != null ? daysAgo(opts.returnedDaysAgo) : null,
        opts.renewed || 0,
        opts.fine || 0,
        opts.fineStatus || 'none',
        opts.returnedDaysAgo != null ? 'returned' : 'active',
        opts.settledDaysAgo != null ? daysAgo(opts.settledDaysAgo) : null
      );
    };

    // Active loans
    loan(minhanh, 'so-do', 5, 9);
    loan(minhanh, 'thoi-quen-nguyen-tu', 12, 2);
    loan(minhanh, 'luoc-su-thoi-gian', 20, -6);
    loan(hoangbao, 'nha-gia-kim', 10, 4);
    loan(hoangbao, 'sapiens', 3, 11);
    loan(thuha, '1984', 18, -4);
    loan(thuha, 'sapiens', 8, 6);
    loan(quochuy, 'clean-code', 6, 8);
    loan(quochuy, 'rung-na-uy', 2, 12);
    loan(gialinh, 'de-men', 7, 7);
    loan(gialinh, 'kinh-te-vi-mo', 9, 5);
    loan(gialinh, 'mat-biec', 4, 10);

    // Returned loans (history + fines)
    loan(hoangbao, 'chi-pheo', 34, -20, { returnedDaysAgo: 18, fine: 20000, fineStatus: 'unpaid' });
    loan(thuha, 'tat-den', 45, -31, { returnedDaysAgo: 27, fine: 15000, fineStatus: 'paid', settledDaysAgo: 25 });
    loan(minhanh, 'hoang-tu-be', 60, 0, { returnedDaysAgo: 47 });
    loan(quochuy, 'tu-duy-nhanh-va-cham', 50, 0, { returnedDaysAgo: 36, renewed: 1 });
    loan(gialinh, 'harry-potter', 40, 0, { returnedDaysAgo: 26 });

    // Reservations
    const insertRes = db.prepare(
      'INSERT INTO reservations (user_id, book_id, created_at, status, ready_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    insertRes.run(minhanh, bookIds.get('de-men'), daysAgo(2), 'ready', daysAgo(0.05), daysAhead(1.9));
    insertRes.run(minhanh, bookIds.get('nha-gia-kim'), daysAgo(1), 'waiting', null, null);
    insertRes.run(quochuy, bookIds.get('sapiens'), daysAgo(0.5), 'waiting', null, null);
    insertRes.run(thuha, bookIds.get('1984'), daysAgo(3), 'waiting', null, null);

    // Reviews
    const insertReview = db.prepare(
      'INSERT INTO reviews (user_id, book_id, rating, comment, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const review = (userId, slug, rating, comment, ago) =>
      insertReview.run(userId, bookIds.get(slug), rating, comment, daysAgo(ago), daysAgo(ago));
    review(minhanh, 'so-do', 5, 'Châm biếm sắc lạnh mà vẫn rất hài hước. Một cuốn không thể bỏ qua.', 30);
    review(minhanh, 'thoi-quen-nguyen-tu', 5, 'Những thay đổi nhỏ mỗi ngày thực sự tạo khác biệt. Dễ đọc, dễ áp dụng.', 21);
    review(hoangbao, 'nha-gia-kim', 4, 'Nhẹ nhàng và giàu suy ngẫm, phù hợp đọc lại nhiều lần.', 14);
    review(hoangbao, 'sapiens', 5, 'Góc nhìn rộng, nhiều chi tiết thú vị về lịch sử loài người.', 9);
    review(quochuy, 'clean-code', 5, 'Cuốn sách nên đọc sớm trong sự nghiệp lập trình.', 7);
    review(quochuy, 'rung-na-uy', 4, 'Không khí buồn và đẹp, âm nhạc len vào từng trang.', 5);
    review(thuha, '1984', 5, 'Đáng sợ vì vẫn còn nhiều điều đúng với hiện tại.', 11);
    review(gialinh, 'de-men', 5, 'Tuổi thơ của tôi nằm trong những trang sách này.', 10);
    review(gialinh, 'mat-biec', 4, 'Nguyễn Nhật Ánh viết về thanh xuân rất khéo.', 6);

    // Favorites
    const insertFav = db.prepare('INSERT INTO favorites (user_id, book_id, created_at) VALUES (?, ?, ?)');
    insertFav.run(minhanh, bookIds.get('mat-biec'), daysAgo(12));
    insertFav.run(minhanh, bookIds.get('suoi-nguon'), daysAgo(8));
    insertFav.run(minhanh, bookIds.get('sapiens'), daysAgo(4));
    insertFav.run(quochuy, bookIds.get('clean-code'), daysAgo(6));
    insertFav.run(quochuy, bookIds.get('thiet-ke-he-thong-du-lieu'), daysAgo(3));
    insertFav.run(hoangbao, bookIds.get('nha-gia-kim'), daysAgo(2));

    // Recompute availability = total - active loans - ready holds
    db.exec(`
      UPDATE books SET available_copies = MAX(0, total_copies
        - (SELECT COUNT(*) FROM loans WHERE loans.book_id = books.id AND loans.status = 'active')
        - (SELECT COUNT(*) FROM reservations WHERE reservations.book_id = books.id AND reservations.status = 'ready'))
    `);

    void admin;
  });

  seedAll();

  const bad = db
    .prepare(
      `SELECT b.slug, b.total_copies, b.available_copies,
        (SELECT COUNT(*) FROM loans l WHERE l.book_id = b.id AND l.status = 'active') AS loans,
        (SELECT COUNT(*) FROM reservations r WHERE r.book_id = b.id AND r.status = 'ready') AS holds
       FROM books b WHERE b.available_copies < 0`
    )
    .all();
  if (bad.length) throw new Error(`Seed availability mismatch: ${JSON.stringify(bad)}`);
}

function ensureSeed(db) {
  const empty = db.prepare('SELECT COUNT(*) AS c FROM users').get().c === 0;
  if (empty) seedDatabase(db);
  return empty;
}

if (require.main === module) {
  const reset = process.argv.includes('--reset');
  if (reset) {
    for (const ext of ['', '-wal', '-shm']) {
      const file = path.join(__dirname, '..', 'data', `library.db${ext}`);
      if (fs.existsSync(file)) fs.rmSync(file);
    }
  }
  const { db } = require('./db');
  ensureSeed(db);
  const counts = {
    users: db.prepare('SELECT COUNT(*) AS c FROM users').get().c,
    books: db.prepare('SELECT COUNT(*) AS c FROM books').get().c,
    loans: db.prepare('SELECT COUNT(*) AS c FROM loans').get().c,
  };
  console.log('Seed ready:', counts);
}

module.exports = { seedDatabase, ensureSeed };
