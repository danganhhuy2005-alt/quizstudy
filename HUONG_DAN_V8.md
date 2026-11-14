# QuizStudy V8 – Import Word chứa ảnh câu hỏi

## Chuẩn file Word

Câu 1
[Chèn 1 ảnh chứa toàn bộ câu hỏi cùng A/B/C/D]

Câu 2
[Chèn 1 ảnh tương tự]

Mỗi câu dùng một ảnh PNG/JPG/WEBP chèn qua Insert > Pictures (không dùng ảnh liên kết ngoài). Nhãn Câu N nằm ở đoạn Word ngay trước ảnh. Tối đa 80 câu / lần và Word tối đa 4 MB, mỗi ảnh 3 MB.

Đáp án có thể tải file DOCX/TXT riêng hoặc dán: `1.B 2.A,C 3.D`; không có thì vào màn hình xem trước và chọn thủ công. Phương án A-D nằm trong ảnh nên hệ thống không OCR hay tự suy đoán đáp án.

## Cài đặt
1. Giữ nguyên cấu hình .env.local hoặc Vercel Environment Variables đang dùng.
2. Supabase Dashboard → SQL Editor → chạy **supabase-images.sql** một lần.
3. Giải nén project này, ghi đè mã nguồn V7, không ghi đè .env.local.
4. npm install; npm run build; npm run dev.
5. Thêm bộ đề → Nhập Word dạng ảnh → chọn Word và (nếu có) đáp án → Đọc Word ảnh → kiểm tra → Lưu.

## Lưu ý
- Các câu hỏi/ảnh được lưu chung qua Supabase; tiến trình làm bài vẫn lưu tại trình duyệt từng thiết bị.
- Không hỗ trợ trộn A-D đối với câu dạng ảnh (vì chữ cái ở trong ảnh).
- Nhập JSON V6 và đề Word dạng chữ vẫn hoạt động.
- Ai có URL website có thể thêm/xóa/sửa bộ đề. Hãy giữ bản sao JSON và Word gốc.
- Phần ảnh đã tải lên chưa được xóa tự động khi xóa bộ đề (tránh phá hỏng đề khác cùng dùng ảnh). Có thể dọn ảnh trong Supabase Storage Dashboard khi cần.
- Nếu muốn trên 80 ảnh hoặc nhiều Word, chia thành nhiều bộ đề để tránh timeout Vercel và tải chậm.
