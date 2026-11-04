import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).send('Webhook is active!');
  }

  try {
    const events = req.body && req.body.events;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(200).send('OK');
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    for (const event of events) {
      if (event.type === 'message' && event.message && event.message.type === 'text') {
        const userId = (event.source && event.source.userId) || 'unknown';
        const text = event.message.text.trim();
        const replyToken = event.replyToken;

        // ดึงชื่อแอคเคาน์ Twitter จากลิงก์
        let twitterAccount = "ไม่ระบุ";
        if (text.includes('x.com/') || text.includes('twitter.com/')) {
          const match = text.match(/(?:x\.com|twitter\.com)\/([^\/]+)/);
          if (match) twitterAccount = match[1];
        }

        // ค่าเริ่มต้นกรณี Gemini อ่านไม่สำเร็จ
        let giveawayData = {
          giveawayName: "Giveaway จาก @" + twitterAccount,
          date: "TBA",
          location: "TBA",
          time: "TBA",
          note: text,
          hashtag: "#Giveaway",
          imageUrl: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=300"
        };

        // ใช้ Gemini วิเคราะห์ข้อความ
        try {
          const prompt = `วิเคราะห์ลิงก์หรือข้อความทวีตนี้: "${text}" แล้วสกัดข้อมูลออกมาเป็น JSON format ตามนี้เท่านั้น (ห้ามมี markdown code block อื่น):
          {
            "giveawayName": "ชื่อของแจก",
            "date": "วันที่จัดงาน",
            "location": "สถานที่รับ",
            "time": "เวลา",
            "note": "รายละเอียดเพิ่มเติม",
            "hashtag": "แฮชแท็ก",
            "imageUrl": "ลิงก์รูปภาพตัวอย่างจากทวีต หรือถ้าไม่มีให้ใส่ค่าว่างเป็นสตริงเปล่า ''"
          }`;

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
          });

          const jsonText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(jsonText);
          giveawayData = {
            ...giveawayData,
            ...parsed,
            imageUrl: (parsed.imageUrl && parsed.imageUrl.startsWith('http')) ? parsed.imageUrl : giveawayData.imageUrl
          };
        } catch (geminiErr) {
          console.error('Gemini Parsing Error:', geminiErr);
        }

        // บันทึกลงฐานข้อมูล Supabase
        await supabase
          .from('giveaway_items')
          .insert([
            {
              user_id: userId,
              account: twitterAccount,
              item: giveawayData.giveawayName,
              url: text,
              status: false
            }
          ]);

        // ส่งข้อความ Flex Message (ดีไซน์ใหม่ของคุณ) กลับไปยัง LINE
        const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        if (lineToken && replyToken) {
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
                  type: "flex",
                  altText: "✨ Completed ✅",
                  contents: {
                    type: "bubble",
                    size: "mega",
                    header: {
                      type: "box",
                      layout: "vertical",
                      backgroundColor: "#FFfdd0",
                      contents: [
                        {
                          type: "text",
                          text: "Completed✅",
                          weight: "bold",
                          size: "xl",
                          color: "#03ac13",
                          align: "start"
                        }
                      ]
                    },
                    body: {
                      type: "box",
                      layout: "vertical",
                      spacing: "md",
                      backgroundColor: "#FFFFFF",
                      contents: [
                        {
                          type: "box",
                          layout: "horizontal",
                          contents: [
                            {
                              type: "box",
                              layout: "vertical",
                              contents: [
                                {
                                  type: "text",
                                  text: `Giveaway : ${giveawayData.giveawayName}`,
                                  wrap: true,
                                  weight: "bold",
                                  size: "md",
                                  color: "#f97ab6"
                                },
                                {
                                  type: "text",
                                  text: `🗓️ Date : ${giveawayData.date}`,
                                  wrap: true,
                                  size: "sm",
                                  color: "#555555",
                                  margin: "sm",
                                  weight: "bold"
                                },
                                {
                                  type: "text",
                                  text: `📍 Location : ${giveawayData.location}`,
                                  wrap: true,
                                  size: "sm",
                                  color: "#555555",
                                  margin: "sm",
                                  weight: "bold"
                                },
                                {
                                  type: "text",
                                  text: `⏳ Time : ${giveawayData.time}`,
                                  wrap: true,
                                  size: "sm",
                                  color: "#555555",
                                  margin: "sm",
                                  weight: "bold"
                                },
                                {
                                  type: "text",
                                  text: `📝 Note : ${giveawayData.note}`,
                                  wrap: true,
                                  size: "sm",
                                  color: "#555555",
                                  margin: "sm",
                                  weight: "bold"
                                },
                                {
                                  type: "text",
                                  text: `🏷️ Hashtag : ${giveawayData.hashtag}`,
                                  wrap: true,
                                  size: "xs",
                                  color: "#0099ff",
                                  margin: "xs",
                                  weight: "bold"
                                }
                              ],
                              flex: 3
                            },
                            {
                              type: "image",
                              url: giveawayData.imageUrl,
                              size: "md",
                              aspectMode: "cover",
                              aspectRatio: "1:1",
                              gravity: "center",
                              flex: 1,
                              margin: "md"
                            }
                          ]
                        }
                      ]
                    }
                  }
                }
              ]
            })
          });
        }
      }
    }
    return res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook Error:', err);
    return res.status(200).send('OK');
  }
}