# QuizStudy V9 — Luyện theo lượt 50 câu

## Cập nhật
Giải nén ZIP, chép nội dung thư mục `quizstudy-cloud` vào project cũ, giữ `.env.local`. Không cần chạy thêm SQL Supabase. Push lên GitHub như trước.

## Chế độ
- **Làm toàn bộ đề**: giữ nguyên trải nghiệm cũ, số câu đầy đủ.
- **Luyện theo lượt**: chọn 10, 20, 30, 50, 100 hoặc 150 câu. Mặc định 50.
- **Không trùng**: trộn và chọn từ những câu chưa được đưa vào lượt trước trên **cùng trình duyệt**, tách biệt theo bộ đề. Đánh dấu đã lấy ngay lúc bắt đầu lượt, không phụ thuộc bạn đã hoàn thành chưa. Nếu chỉ còn 30 câu, lượt 50 sẽ có 30. Nếu hết câu, bấm **Xóa lịch sử lượt** để học lại.
- **Cho phép trùng**: chọn ngẫu nhiên từ toàn bộ nguồn mỗi lượt, có thể gặp lại câu ở lượt trước; không trùng trong cùng lượt.
- **Tiếp tục**: lưu tiến trình như V8; đổi chế độ không làm mất lượt đã lưu.
- **Reset**: đặt lại các lựa chọn trong lượt đang làm; không xóa lịch sử đã lấy.
- **Xóa lịch sử lượt**: xóa danh sách câu đã lấy (không xóa bộ đề, không xóa tiến trình đang làm).
- **Làm toàn bộ đề** không tính vào lịch sử không trùng.

## Lưu trữ
Thư viện/bộ đề dùng chung Supabase. Tiến trình và lịch sử lượt là localStorage, nên chưa đồng bộ giữa trình duyệt, máy tính hoặc điện thoại. Muốn đồng bộ cần cơ chế nhận diện người dùng và bảng dữ liệu tiến trình trên Supabase.

## Cập nhật GitHub
```powershell
git add app/page.tsx app/globals.css HUONG_DAN_V9.md
git commit -m "QuizStudy V9 study batches and no-repeat tracking"
git push origin main
```

Không cần Gemini/API.
