# QuizStudy V12 – Lịch sử ôn tập + Sao lưu

## Tính năng
- Mỗi bộ đề có nút **Lịch sử**. Lưu từng lượt và lựa chọn đã thực hiện; xem câu đúng/sai và ảnh đề.
- Lọc lịch sử theo tất cả / sai hoặc chưa chọn / đúng.
- Lưu lượt tự động trong khi học; `Tiếp tục` phục hồi lượt đang dở.
- **Không trùng** vẫn sử dụng khóa `quizstudy-studied-v9:<deckId>` của bản V11. Bộ đề và đáp án trên Supabase không thay đổi.
- `Xuất sao lưu tiến trình` tải một file JSON chứa các khóa localStorage lịch sử, tiến trình và danh sách đã lấy. `Khôi phục sao lưu` chỉ nhận định dạng sao lưu V12.
- Nút Reset chỉ đặt lại lượt hiện tại; không xóa lịch sử các lượt cũ.

## Nâng cấp
1. Giải nén mã nguồn V12 và ghi đè project V11. **Không xóa** dữ liệu/trình duyệt hiện đang lưu QuizStudy.
2. Giữ `.env.local` trên máy và biến môi trường Vercel hiện có. Không cần SQL mới.
3. `npm install`, `npm run build` để kiểm tra trên máy.
4. `git add . && git commit -m "QuizStudy V12 history and backup" && git push origin main`.
5. Trên đúng domain và trình duyệt đã ôn, mở QuizStudy → `Xuất sao lưu tiến trình` ngay sau khi V12 chạy.

## Giới hạn và lưu ý
- Lịch sử lưu trên trình duyệt (localStorage), chưa tự đồng bộ giữa thiết bị. Sao lưu JSON để chuyển sang trình duyệt khác.
- V11 lưu 1 lượt hiện tại và danh sách câu đã lấy ở chế độ Không trùng. V12 tự chuyển **lượt đang lưu** vào lịch sử, nhưng không thể dựng lại đáp án các lượt hoàn thành đã bị V11 ghi đè.
- Không nên xóa dữ liệu website, đổi domain hoặc dùng chế độ ẩn danh trước khi sao lưu.
- Khi bộ đề gốc đã bị xóa khỏi Supabase, lịch sử chỉ lưu ID/đáp án và sẽ không hiển thị lại văn bản/ảnh câu hỏi bị xóa.
- Lịch sử lưu tối đa 80 lượt mỗi môn, tùy dung lượng bộ nhớ trình duyệt.
- Đã kiểm tra cú pháp TSX; chưa chạy được full Next.js build vì bước cài thư viện bị timeout trong môi trường tạo file.
