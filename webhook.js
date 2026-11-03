// ... (ส่วนบนของโค้ดเหมือนเดิม) ...

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
                   altText: "🎁 GIVEAWAY DETECTED!",
                   contents: {
                     type: "bubble",
                     size: "mega",
                     header: {
                       type: "box",
                       layout: "vertical",
                       backgroundColor: "#FFE5F1",
                       contents: [
                         {
                           type: "text",
                           text: "🎁 GIVEAWAY DETECTED! 🎁",
                           weight: "bold",
                           size: "xl",
                           color: "#FF428A",
                           align: "center"
                         }
                       ]
                     },
                     body: {
                       type: "box",
                       layout: "vertical",
                       spacing: "md",
                       backgroundColor: "#FFFFFF",
                       contents: [
                         { type: "text", text: `💝 Giveaway: จาก @${twitterAccount}`, wrap: true, weight: "bold", size: "md" },
                         { type: "text", text: "🗓️ Date: (รอต่อข้อมูล)", wrap: true, size: "sm" },
                         { type: "text", text: "📍 Location: (รอต่อข้อมูล)", wrap: true, size: "sm" },
                         { type: "text", text: "⏳ Time: TBA", wrap: true, size: "sm" },
                         { type: "text", text: "📝 Note: pls kindly rt kub 🍎", wrap: true, size: "sm" },
                         { type: "text", text: "🏷️ Hashtag: #Giveaway", wrap: true, size: "sm", color: "#AAAAAA" }
                       ]
                     }
                   }
                 },
                 {
                   type: "text",
                   text: "I've saved this for you! What would you like to do next? ✨"
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