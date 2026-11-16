# QuizStudy V13 – Ôn lại theo khoảng câu, không ảnh hưởng dữ liệu V12

## Thay đổi
- Nhập số đầu/cuối (mặc định 250–300), nhấn **Ôn khoảng câu 250–300** trên đúng bộ đề. Lấy câu theo trường `number` của dữ liệu gốc, bao gồm cả hai đầu. Nếu thiếu số, chỉ lấy những câu thật sự tồn tại.
- **Không** thêm ID vào danh sách `quizstudy-studied-v9:<deckId>` (Không trùng).
- **Không** ghi đè tiến trình cũ `quizstudy-progress-v5:<deckId>`; lượt ôn khoảng được tự lưu riêng ở `quizstudy-range-progress-v13:<deckId>`.
- Nút **Tiếp tục ôn khoảng** xuất hiện riêng cho từng bộ đề; có thể xen kẽ trở lại nút **Tiếp tục** của lượt thường.
- Lịch sử V12 (`quizstudy-history-v12`) giữ nguyên; lượt ôn khoảng mới được lưu vào lịch sử chung.
- Sao lưu V13 xuất cả khóa V12 lẫn V13. **Khôi phục** nhận file sao lưu phiên bản 12 hoặc 13.
- Các tính năng zoom ảnh, trả lời ngay, kết quả, Supabase không đổi. Không cần SQL hay đổi biến môi trường.

## Nâng cấp an toàn
1. Trên site V12 hiện tại, bấm **Xuất sao lưu tiến trình** và giữ file JSON.
2. Thay các file mã nguồn trong project bằng ZIP V13, giữ nguyên `.env.local` và không xóa localStorage của domain cũ.
3. Chạy `npm install` (nếu thiếu node_modules), `npm run typecheck`, `npm run build`. Sau khi build thành công: `git add .`, `git commit -m "QuizStudy V13 review question range"`, `git push origin main`.
4. Mở **đúng domain, đúng trình duyệt** V12 để thấy tiến trình cũ.

## Lưu ý
- Chọn 250–300 là theo **số câu hiển thị trong bộ đề**, không phải thứ tự lượt ôn hoặc vị trí ngẫu nhiên của câu.
- Danh sách “đã lấy” không đồng nghĩa câu đã trả lời: hệ thống V12 đánh dấu đã lấy ngay khi tạo lượt. Các lượt V11 không được lưu lịch sử chi tiết không thể tự khôi phục đáp án đã chọn.
- Lịch sử và tiến trình là dữ liệu localStorage của từng trình duyệt/domain; sao lưu là biện pháp dự phòng trước nâng cấp.
