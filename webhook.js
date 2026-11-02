import { createClient } from '@supabase/supabase-js'

// สร้าง Supabase Client โดยดึงค่าจาก Environment Variables บน Vercel
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  // รองรับเฉพาะเมธอด POST ที่ส่งมาจาก LINE Messaging API เท่านั้น
  if (req.method !== 'POST') {
    return res.status(405).send({ message: 'Method Not Allowed' })
  }

  const events = req.body.events;
  if (!events || !Array.isArray(events)) {
    return res.status(200).send('OK');
  }

  for (const event of events) {
    // ตรวจสอบว่าเป็นเหตุการณ์ข้อความที่เป็น Text
    if (event.type === 'message' && event.message.type === 'text') {
      const userId = event.source.userId;
      const text = event.message.text.trim();

      // ตัวอย่าง: บันทึกข้อความที่พิมพ์มาลงในฟิลด์ title หรือ note ของตาราง giveaway_items
      // (หมายเหตุ: ตารางนี้ต้องการ owner_id ซึ่งในที่นี้อาจใช้ LINE userId แทนได้ครับ)
      const { data, error } = await supabase
        .from('giveaway_items')
        .insert([
          { 
            owner_id: userId,          // ใช้ LINE User ID เป็นเจ้าของรายการ
            title: text,               // นำข้อความที่พิมพ์มาใส่เป็นชื่อรายการ
            post_url: 'https://x.com', // ค่าเริ่มต้นหรือลิงก์สำรอง
            is_done: false             // กำหนดสถานะเริ่มต้นเป็นยังไม่เก็บ
          }
        ]);

      if (error) {
        console.error('Supabase Insert Error:', error);
      }
    }
  }

  return res.status(200).send('OK');
}