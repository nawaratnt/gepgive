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

        let twitterAccount = "ไม่ระบุ";
        let tweetImageUrl = ""; 
        let tweetTextForGemini = text; // ตัวแปรสำหรับเก็บข้อความที่จะส่งให้ AI

        // 1. ดึงข้อความทวีต และรูปภาพ จากลิงก์อัตโนมัติ (Bypass Twitter Block)
        const tweetMatch = text.match(/(?:x\.com|twitter\.com)\/([^\/]+)\/status\/(\d+)/);
        if (tweetMatch) {
          twitterAccount = tweetMatch[1];
          try {
            const vxUrl = `https://api.vxtwitter.com/${tweetMatch[1]}/status/${tweetMatch[2]}`;
            const vxRes = await fetch(vxUrl);
            const vxData = await vxRes.json();
            
            // ถ้าดึงข้อความสำเร็จ ให้เอาข้อความทวีตไปแทนที่ลิงก์เปล่าๆ
            if (vxData && vxData.text) {
              tweetTextForGemini = vxData.text; 
            }
            
            // ดึงรูปภาพ
            if (vxData && vxData.mediaURLs && vxData.mediaURLs.length > 0) {
              tweetImageUrl = vxData.mediaURLs[0];
            }
          } catch (e) {
            console.error("Fetch Data Error:", e);
          }
        } else if (text.includes('x.com/') || text.includes('twitter.com/')) {
           const accMatch = text.match(/(?:x\.com|twitter\.com)\/([^\/]+)/);
           if (accMatch) twitterAccount = accMatch[1];
        }

        let giveawayData = {
          giveawayName: "From @" + twitterAccount,
          date: "TBA",
          location: "TBA",
          time: "TBA",
          note: "-",
          hashtag: "-",
          imageUrl: tweetImageUrl || "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=300"
        };

        // 2. ใช้ Gemini วิเคราะห์เนื้อหาทวีตที่ดึงมาได้
        try {
          const prompt = `สกัดข้อมูลจากข้อความนี้: "${tweetTextForGemini}"
          ให้ออกมาเป็น JSON เท่านั้น โดยใช้ key ตามนี้เป๊ะๆ:
          {
            "giveawayName": "ดึงชื่อของแจกหลักให้อยู่ในรูปแบบที่ชัดเจน เช่น "Carabiner & Brooch", "Cookies, Pudding cup", "Card Sticker Set" หากข้อความใช้ฟอนต์พิเศษ (Unicode font) ให้แปลงเป็นตัวอักษรอังกฤษปกติ (ถ้าไม่เจอให้ตอบ "giveaway")",
            "date": "หาพิกัดสถานที่แจก เช่น หลังอีโมจิ 📍 หรือคำว่า location / stadium เช่น "Impact Arena", "Thammasat Stadium", "tba"",
            "location": "หาพิกัดสถานที่แจก เช่น หลังอีโมจิ 📍 หรือคำว่า location / stadium เช่น "Impact Arena", "Thammasat Stadium", "tba"",
            "time": "เวลา (ถ้าไม่ระบุให้ใส่ TBA)",
            "note": "รายละเอียดเพิ่มเติมสั้นๆ (ถ้าไม่มีให้ใส่ -)",
            "hashtag": "ดึงแฮชแท็กทั้งหมดในทวีตมารวมกันเว้นวรรค เช่น "#JASPERCONCERT #Santapp" #THE_REDLINE_BANGKOK #NCT127_5TH_NEOCITY_BANGKOK_THE_REDLINE"(จะอยู่ท้ายๆของทวีต)"
          }`;

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
              responseMimeType: "application/json"
            }
          });

          const parsed = JSON.parse(response.text.trim());
          giveawayData = {
            ...giveawayData,
            giveawayName: (parsed.giveawayName && parsed.giveawayName !== "Giveaway") ? parsed.giveawayName : giveawayData.giveawayName,
            date: parsed.date || "TBA",
            location: parsed.location || "TBA",
            time: parsed.time || "TBA",
            note: parsed.note || "-",
            hashtag: parsed.hashtag || "-"
          };
        } catch (geminiErr) {
          console.error('Gemini Parsing Error:', geminiErr);
        }

        // 3. บันทึกลง Supabase
        await supabase
          .from('giveaway_items')
          .insert([
            {
              user_id: userId,
              account: twitterAccount,
              item: giveawayData.giveawayName,
              url: text, // เก็บลิงก์ต้นฉบับ
              status: false
            }
          ]);

        // 4. ส่ง Flex Message กลับ
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
                                { type: "text", text: `Giveaway : ${giveawayData.giveawayName}`, wrap: true, weight: "bold", size: "md", color: "#f97ab6" },
                                { type: "text", text: `🗓️ Date : ${giveawayData.date}`, wrap: true, size: "sm", color: "#555555", margin: "sm", weight: "bold" },
                                { type: "text", text: `📍 Location : ${giveawayData.location}`, wrap: true, size: "sm", color: "#555555", margin: "sm", weight: "bold" },
                                { type: "text", text: `⏳ Time : ${giveawayData.time}`, wrap: true, size: "sm", color: "#555555", margin: "sm", weight: "bold" },
                                { type: "text", text: `📝 Note : ${giveawayData.note}`, wrap: true, size: "sm", color: "#555555", margin: "sm", weight: "bold" },
                                { type: "text", text: `🏷️ Hashtag : ${giveawayData.hashtag}`, wrap: true, size: "xs", color: "#0099ff", margin: "xs", weight: "bold" }
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