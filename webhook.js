import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send({ message: 'Method Not Allowed' })
  }

  const events = req.body.events;
  if (!events || !Array.isArray(events)) {
    return res.status(200).send('OK');
  }

  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const userId = event.source.userId;
      const text = event.message.text.trim();
      const replyToken = event.replyToken;

      try {
        // 1. ดึงชื่อ Twitter Account จากลิงก์ (ใส่คอลัมน์ account)
        let twitterAccount = "ไม่ระบุ";
        if (text.includes('x.com/') || text.includes('twitter.com/')) {
            const match = text.match(/(?:x\.com|twitter\.com)\/([^\/]+)/);
            if (match) twitterAccount = match[1];
        }

        // 2. บันทึกลง Supabase (ใช้ชื่อคอลัมน์ตามตารางใหม่ของคุณ)
        const { error } = await supabase
          .from('giveaway_items')
          .insert([
            { 
              user_id: userId,
              account: twitterAccount, 
              item: "Giveaway จาก @" + twitterAccount, 
              url: text,
              status: false
            }
          ]);

        if (error) {
            console.error('Supabase Insert Error:', error);
        }

        // 3. ตอบกลับ LINE
        const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        if (lineToken) {
           await fetch('https://api.line.me/v2/bot/message/reply', {
             method: 'POST',
             headers: {
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${lineToken}`
             },
             body: JSON.stringify({
               replyToken: replyToken,
               messages: [
                 {
                   type: 'text',
                   text: `✨ บันทึก Giveaway จาก @${twitterAccount} ลงเช็กลิสต์เรียบร้อยแล้วค่ะ! 💗`
                 }
               ]
             })
           });
        }

      } catch (err) {
         console.error('Webhook Error:', err);
      }
    }
  }

  return res.status(200).send('OK');
}