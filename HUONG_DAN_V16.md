# QuizStudy V16 – OCR nhận diện lựa chọn trong Word ảnh

## Thay đổi
- Tải DOCX ảnh như V15; đọc số câu và ghi chú `Chọn 2/3 đáp án` từ Word.
- Trước khi upload lên Supabase Storage, dùng `tesseract.js` (OCR chạy trong trình duyệt) để đọc từng ảnh, phát hiện nhãn A–H có dạng `A.`, `B)`, `(C)` v.v.
- Tự gợi ý số lựa chọn từ những nhãn OCR tìm thấy. Không suy đoán *đáp án đúng*. Nếu OCR thiếu/không chắc chắn, đánh dấu cảnh báo trong màn hình sửa; người dùng kiểm tra ảnh và chỉnh số lựa chọn.
- Đáp án E/F/G/H được giữ nếu có trong key. Không tự ý giới hạn A–D.
- Các tính năng Supabase, Không trùng, lịch sử và lưu tiến trình vẫn giữ nguyên mã V15.

## Cài đặt
1. Sao lưu lịch sử/tiến trình trên web trước khi cập nhật. Không xóa dữ liệu trình duyệt.
2. Giải nén bản V16, chép các file vào dự án V15 của bạn (không ghi đè `.env.local`).
3. Chạy `npm install` để cài thêm `tesseract.js`, sau đó `npm run typecheck` và `npm run build`.
4. Nếu build thành công: `git add .`, `git commit -m "QuizStudy V16 OCR Word choices"`, `git push origin main`.
5. Vào Thêm đề → Nhập Word dạng ảnh. OCR chạy trước khi tải ảnh lên Supabase. Vào trang chỉnh sửa kiểm tra các câu có cảnh báo OCR; sau đó bấm Lưu.

## Giới hạn
- OCR cần tải script/worker và mô hình `eng` qua Internet lần đầu. Mạng hạn chế/cấm CDN có thể làm OCR không khởi tạo được; trường hợp này web báo lỗi và chưa upload ảnh.
- Ảnh nhòe, nhãn A–F sắp xếp dạng cột hoặc font lạ có thể bị nhận thiếu/sai. Không cam kết chính xác 100%; cần kiểm tra các câu đáng ngờ, đặc biệt câu chọn nhiều hoặc có E/F.
- Đối với hàng trăm ảnh, nhận diện tuần tự có thể chậm. Có hiển thị số ảnh đang xử lý.
- OCR chỉ đếm **lựa chọn**, không phân tích/đoán nội dung kiến thức hoặc đáp án đúng.

## Phạm vi kiểm tra
Đã kiểm tra cú pháp TypeScript nguồn bằng transpiler. Chưa thể cài package và build đầy đủ trong môi trường tạo file (không truy cập được npm registry). Người dùng cần chạy các lệnh kiểm tra trước khi push.
