const rows={
 'My routine':['我的日常','毎日の予定','Lịch sinh hoạt'],
 'Set meal times (optional)':['设置用餐时间（可选）','食事時間の設定（任意）','Đặt giờ ăn (tùy chọn)'],
 'Post-workout snack (optional)':['训练后加餐（可选）','運動後の軽食（任意）','Ăn nhẹ sau tập (tùy chọn)'],
 'Change time today':['更改今天的时间','今日の時間を変更','Đổi giờ hôm nay'],
};
export default Object.fromEntries(['zh','ja','vi'].map((lang,i)=>[lang,Object.fromEntries(Object.entries(rows).map(([key,values])=>[key,values[i]]))]));
