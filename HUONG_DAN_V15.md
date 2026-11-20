# QuizStudy V15 – lựa chọn A–H cho Word ảnh

## Sửa lỗi
- V14 mặc định chỉ tạo A–D cho mọi ảnh, dẫn đến câu có lựa chọn E/F bị thiếu và key E/F bị bỏ qua.
- V15 không bỏ đáp án E/F/G/H nếu key có những chữ này.
- Dòng Word `Câu 114 (Chọn 3 đáp án)` tự nhận số **đáp án phải chọn** là 3 (không phải số lựa chọn).
- Khi đọc Word ảnh, mặc định 4 lựa chọn; với nhãn chọn 2 hoặc 3, giao diện **gợi ý** A–E hoặc A–F. Nếu key có G/H, mở rộng tới key đó.
- Ở màn hình **Kiểm tra trước khi đăng**, mở ảnh bằng Zoom, chọn số lựa chọn thật sự A–B ... A–H, chọn số đáp án cần chọn và tích key đúng.
- Nếu câu ghi Chọn 3 nhưng chỉ có 2 đáp án đã gắn, V15 chặn Save và báo số câu để chỉnh. Nếu chưa có key, cho phép lưu như câu chưa được chấm (không bịa key).
- **Không có OCR tự động**: các số lượng A–F gợi ý chưa phải xác nhận đã đọc ảnh. Vui lòng đối chiếu ảnh.

## Cập nhật từ V14
Sao lưu tiến trình trên website. Giải nén và **chỉ thay**:
- `lib/word-image-client.ts`
- `lib/types.ts`
- `lib/server.ts`
- `app/page.tsx`
- `app/globals.css`

Mở terminal từ thư mục dự án:
```
npm run typecheck
npm run build
git add app/page.tsx app/globals.css lib/word-image-client.ts lib/types.ts lib/server.ts
git commit -m "QuizStudy V15 image A-H answer controls"
git push origin main
```

## Bộ đề đã lưu
Không cần xóa hoặc upload lại ảnh. Vào bộ đề đang có → **Sửa** → xem ảnh → chọn A–F nếu ảnh có 6 lựa chọn → nhập lại key có E/F bằng chức năng **Nhập lại file đáp án** → Lưu.

**Lưu ý tiến trình:** sửa câu hỏi hiện có giữ `id` câu (không làm hỏng localStorage). Không xóa bộ đề rồi tạo lại nếu muốn giữ tiến trình theo ID cũ.

## Kiểm thử
Đã kiểm tra cú pháp TypeScript/TSX; chưa chạy được npm install/build Next.js đầy đủ trong môi trường hiện tại. Vui lòng chạy `npm run typecheck` và `npm run build` trước khi push.
