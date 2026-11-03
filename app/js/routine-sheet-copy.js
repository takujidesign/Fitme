import {getState} from './store.js';
// Explicit strings keep the lazily loaded sheet translated even before a dictionary loads.
export const copy = {
 water:['ดื่มน้ำ','Drink water','喝水','水分補給','Uống nước'], caffeine:['งดคาเฟอีน','Caffeine cut-off','停止咖啡因','カフェインを控える','Ngừng caffeine'],screens:['ปิดจอ','Screens off','关闭屏幕','画面をオフ','Tắt màn hình'],eatStart:['เริ่มกินได้','Eating window starts','进食开始','食事開始','Bắt đầu khung ăn'],fastStart:['เริ่มอดอาหาร','Fasting starts','禁食开始','断食開始','Bắt đầu nhịn ăn'],
 setMeals:['ตั้งเวลามื้อเอง (ไม่บังคับ)','Set meal times (optional)','设置用餐时间（可选）','食事時間の設定（任意）','Đặt giờ ăn (tùy chọn)'],
 optionalSnack:['ของว่างหลังซ้อม (ไม่บังคับ)','Post-workout snack (optional)','训练后加餐（可选）','運動後の軽食（任意）','Ăn nhẹ sau tập (tùy chọn)'],
 title:['กิจวัตรของฉัน','My routine','我的日常','毎日の予定','Lịch sinh hoạt'],
 wake:['ตื่นนอน','Wake up','起床','起床','Thức dậy'], bed:['เข้านอน','Bedtime','就寝','就寝','Giờ ngủ'], workout:['ออกกำลังกาย','Workout','训练','運動','Tập luyện'],
 meals:['มื้อต่อวัน','Meals per day','每日餐数','1日の食事回数','Số bữa mỗi ngày'], meal:['มื้อ','Meal','餐','食事','Bữa'],
 automatic:['อัตโนมัติ','Automatic','自动','自動','Tự động'],fixed:['ตั้งเวลาเอง','Set time','固定时间','時間を指定','Đặt giờ'],
 activities:['กิจกรรม','Activities','活动','活動','Hoạt động'],add:['เพิ่มกิจกรรม','Add activity','添加活动','活動を追加','Thêm hoạt động'],
 label:['ชื่อกิจกรรม','Activity label','活动名称','活動名','Tên hoạt động'],start:['เริ่ม','Start','开始','開始','Bắt đầu'],end:['สิ้นสุด','End','结束','終了','Kết thúc'],
 busy:['ไม่ว่าง','Busy','忙碌','予定あり','Bận'],free:['ว่าง','Free','空闲','自由','Rảnh'],remove:['ลบ','Delete','删除','削除','Xóa'],
 weekend:['วันหยุดใช้เวลาต่างกัน','Different weekend times','周末使用不同时间','週末は別の時間','Giờ cuối tuần khác'],
 snack:['แนะนำของว่างหลังซ้อม','Suggest a post-workout snack','建议训练后加餐','運動後の軽食を提案','Gợi ý ăn nhẹ sau tập'],
 preview:['ตัวอย่างแผน','Live timeline preview','日程预览','予定のプレビュー','Xem trước lịch'],save:['บันทึก','Save','保存','保存','Lưu'],
 cancel:['ยกเลิก','Cancel','取消','キャンセル','Hủy'],fix:['ให้ระบบจัดให้','Make automatic','改为自动','自動で設定','Để tự động'],
 today:['เปลี่ยนเวลาวันนี้','Change time today','更改今天的时间','今日の時間を変更','Đổi giờ hôm nay'],daily:['ใช้ทุกวัน','Use every day','每天使用','毎日使用','Dùng mỗi ngày'],
 moved:['ย้ายตามเวลาที่เปลี่ยน','Moved to follow the changed time','已随新时间调整','変更した時間に合わせて移動','Đã chuyển theo giờ mới'],unchanged:['บันทึกเวลาแล้ว','Time saved','时间已保存','時間を保存しました','Đã lưu giờ'],
 fast:['อดอาหาร','Implied fast','推算禁食时长','推定断食時間','Thời gian nhịn ăn'],hours:['ชม.','h','小时','時間','giờ'],minutes:['นาที','min','分钟','分','phút'],
 mismatch:['เวลาไม่ตรงรูปแบบ IF ที่เลือก','Times differ from the selected IF pattern','时间与所选禁食模式不符','選択した断食パターンと異なります','Giờ khác khung nhịn ăn đã chọn'],
 update:['อัปเดตช่วงกิน / รูปแบบ IF','Update eating start / IF pattern','更新进食开始时间 / 禁食模式','食事開始時間・断食パターンを更新','Cập nhật giờ ăn / kiểu nhịn ăn'],
 wakeWarning:['ใกล้เวลาตื่นน้อยกว่า 20 นาที','Less than 20 min after waking','起床后不足20分钟','起床から20分未満','Chưa đủ 20 phút sau thức dậy'],
 bedWarning:['ก่อนนอนน้อยกว่า 2 ชม.','Less than 2 h before bed','距就寝不足2小时','就寝まで2時間未満','Cách giờ ngủ dưới 2 giờ'],
 spacingWarning:['มื้อห่างกันน้อยกว่า 60 นาที','Meals less than 60 min apart','两餐间隔不足60分钟','食事の間隔が60分未満','Các bữa cách nhau dưới 60 phút'],
 workoutWarning:['ชนช่วงออกกำลังกาย','Inside the workout block','与训练时间冲突','運動時間と重なります','Trùng giờ tập'],
 busyWarning:['ชนกิจกรรมที่ไม่ว่าง','Inside a busy activity','与忙碌活动冲突','予定のある時間と重なります','Trùng hoạt động bận'],
 ifWarning:['นอกช่วงกิน IF','Outside the IF window','不在进食窗口内','食事可能時間外','Ngoài khung ăn IF'],
 sleepWarning:['ออกกำลังกายตรงกับเวลานอน','Workout overlaps sleep','训练与睡眠冲突','運動が睡眠時間と重なります','Tập luyện trùng giờ ngủ'],
 unplacedWarning:['ไม่มีช่วงว่างพอสำหรับมื้ออัตโนมัติ','No free time for this automatic meal','没有足够空闲时间安排此餐','自動の食事を配置する空き時間がありません','Không đủ thời gian trống cho bữa tự động'],
 invalid:['กรุณากรอกเวลาและชื่อกิจกรรม','Enter valid times and activity labels','请输入有效时间和活动名称','有効な時間と活動名を入力してください','Nhập giờ hợp lệ và tên hoạt động'],
 days:[['อา','จ','อ','พ','พฤ','ศ','ส'],['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],['日','一','二','三','四','五','六'],['日','月','火','水','木','金','土'],['CN','T2','T3','T4','T5','T6','T7']]
};
export const R = key => copy[key][Math.max(0,['th','en','zh','ja','vi'].indexOf(getState().lang))];
