UPDATE user_appearance SET theme='material', updated_at=strftime('%s','now')*1000 WHERE theme='custom';
