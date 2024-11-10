// นำเข้าโมดูลที่จำเป็น
const line = require('@line/bot-sdk');
const express = require('express');
const request = require('request').defaults({ jar: true });
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// ตั้งค่าการเชื่อมต่อกับ Line API
const config = {
  channelAccessToken: 'UKcDMbQt8jAwg7zji13tVf50BPdwOsQYhtyK1D+kACdxYJt1XKY0kvhYdiOK8GE4fgHsrakIGT9Q4UCphSpIhN JwMBeDKaWMzU06YUwhHUqiD7qE5H3GSVvKvpFygwA7DXP8MroQPNW+onG+UYXQ1AdB04t89/1O/w1cDnyilFU=', // แทนที่ด้วย Channel Access Token ของคุณ
  channelSecret: '6884027b48dc05ad5deadf87245928da' // แทนที่ด้วย Channel Secret ของคุณ
};

// สร้าง Line client และ Express app
const client = new line.Client(config);
const app = express();

// ใช้ middleware สำหรับตรวจสอบลายเซ็นของ Line
app.post('/webhook', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// เริ่มเซิร์ฟเวอร์ที่พอร์ตที่กำหนด
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Line bot is running on port ${PORT}`);
});

// เก็บสถานะของผู้ใช้ในการสนทนา
const userSessions = {};

// เบอร์มือถือที่ใช้ในการรับเงิน
const mobileNumber = '0825658423';

// ฟังก์ชันสำหรับแรนดอม UUID
function generateUUID() {
  return uuidv4();
}

// ฟังก์ชันสำหรับสร้างเวลา expiryTime (ตามจำนวนวันที่กำหนด)
function generateExpiryTime(days) {
  const now = new Date();
  const expiryDate = new Date(now.setDate(now.getDate() + days));
  return expiryDate.getTime();
}

// ฟังก์ชันสำหรับเข้าสู่ระบบ
function login(callback) {
  const loginOptions = {
    method: 'POST',
    url: 'http://www.opensignal.com.esnfvpnfreevip_bot.itow.online:2053/GaKtR4zXrqhyIpG/login',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    form: {
      'username': '01AlTQySvR',
      'password': 'QG77bUywmS'
    }
  };

  request(loginOptions, function (error, response) {
    if (error) {
      console.error('เกิดข้อผิดพลาดในการเข้าสู่ระบบ:', error);
      return;
    }
    try {
      const body = JSON.parse(response.body);
      if (body.success) {
        console.log('เข้าสู่ระบบสำเร็จ:', body.msg);
        callback(); // เรียกใช้ฟังก์ชันถัดไป
      } else {
        console.log('เข้าสู่ระบบล้มเหลว:', body.msg);
      }
    } catch (e) {
      console.error('ไม่สามารถแปลงข้อมูลการตอบกลับเป็น JSON ได้:', e);
      console.log('Response Body:', response.body);
    }
  });
}

// ฟังก์ชันสำหรับเพิ่มลูกค้าใหม่
function addNewClient(session, successCallback, errorCallback) {
  const clientUUID = generateUUID();
  const expiryTime = generateExpiryTime(session.days);
  const totalGB = session.gbLimit > 0 ? session.gbLimit * 1024 * 1024 * 1024 : 0; // Convert GB to bytes

  const options = {
    method: 'POST',
    url: 'http://www.opensignal.com.esnfvpnfreevip_bot.itow.online:2053/GaKtR4zXrqhyIpG/panel/api/inbounds/addClient',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: 12,
      settings: JSON.stringify({
        clients: [{
          id: clientUUID,
          alterId: 0,
          email: session.codeName, // ใช้ชื่อที่ผู้ใช้ตั้ง
          limitIp: 2,
          totalGB: totalGB > 0 ? totalGB : 0,
          expiryTime: expiryTime,
          enable: true,
          tgId: '',
          subId: ''
        }]
      })
    })
  };

  request(options, function (error, response) {
    if (error) {
      console.error('เกิดข้อผิดพลาดในการส่งคำขอ:', error);
      errorCallback('เกิดข้อผิดพลาดในการส่งคำขอ');
      return;
    }
    try {
      const body = JSON.parse(response.body);
      if (body.success) {
        console.log('เพิ่มลูกค้าสำเร็จ:', body.msg);
        // สร้างโค้ดตามที่ต้องการ
        const clientCode = `vless://${clientUUID}@104.18.34.21:80?path=%2F&security=none&encryption=none&host=www.opensignal.com.esnfvpnfreevip_bot.itow.online&type=ws#${encodeURIComponent(session.codeName)}`;
        successCallback(clientCode);
      } else {
        console.log('การเพิ่มลูกค้าล้มเหลว:', body.msg);
        errorCallback(body.msg);
      }
    } catch (e) {
      console.error('ไม่สามารถแปลงข้อมูลการตอบกลับเป็น JSON ได้:', e);
      console.log('Response Body:', response.body);
      errorCallback('ไม่สามารถแปลงข้อมูลการตอบกลับเป็น JSON ได้');
    }
  });
}

// ฟังก์ชันสำหรับจัดการลิงก์ซองอั่งเปา
function processTrueMoneyGiftCode(replyToken, code) {
  const options = {
    method: 'POST',
    url: `https://gift.truemoney.com/campaign/vouchers/${code}/redeem`,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Origin': 'https://gift.truemoney.com',
      'Accept-Language': 'en-US,en;q=0.9',
      'Connection': 'keep-alive'
    },
    body: JSON.stringify({
      mobile: mobileNumber,
      voucher_hash: code
    })
  };

  request(options, function(error, response) {
    if (error) {
      console.error('เกิดข้อผิดพลาดในการส่งคำขอ:', error);
      client.replyMessage(replyToken, { type: 'text', text: '🚫 เกิดข้อผิดพลาดในการรับเงิน โปรดลองใหม่อีกครั้ง' });
      return;
    }

    if (response.statusCode === 200) {
      // แปลงข้อมูลการตอบกลับเพื่อรับจำนวนเงิน
      try {
        const body = JSON.parse(response.body);
        if (body && body.data && body.data.my_ticket && body.data.my_ticket.amount_baht) {
          const amount = parseFloat(body.data.my_ticket.amount_baht);
          client.replyMessage(replyToken, { type: 'text', text: `✅ รับเงินจำนวน ${amount} บาท เรียบร้อยแล้ว! ขอบคุณที่โดเนทครับ 🙏` });
          // อัปเดตเครดิตของผู้ใช้
          updateUserCredits(replyToken, amount);
        } else {
          client.replyMessage(replyToken, { type: 'text', text: '🚫 เกิดข้อผิดพลาดในการรับข้อมูลจำนวนเงิน' });
        }
      } catch (e) {
        console.error('Error parsing response:', e);
        client.replyMessage(replyToken, { type: 'text', text: '🚫 เกิดข้อผิดพลาดในการประมวลผลข้อมูล' });
      }

    } else {
      console.log('Response:', response.body);
      client.replyMessage(replyToken, { type: 'text', text: '🚫 เกิดข้อผิดพลาดในการรับเงิน โปรดตรวจสอบลิงก์และลองใหม่อีกครั้ง' });
    }
  });
}

// ฟังก์ชันสำหรับอัปเดตเครดิตของผู้ใช้
let usersData = {};

// ชื่อไฟล์ที่ใช้เก็บข้อมูลผู้ใช้
const path = 'transactions.json';

// อ่านข้อมูลผู้ใช้จากไฟล์เมื่อเริ่มต้นโปรแกรม
if (fs.existsSync(path)) {
  // ถ้าไฟล์มีอยู่ ให้อ่านข้อมูลจากไฟล์
  try {
    const data = fs.readFileSync(path, 'utf8');
    usersData = JSON.parse(data);
  } catch (err) {
    console.error('Error reading transactions.json:', err);
    usersData = {};
  }
} else {
  // ถ้าไฟล์ไม่พบ ให้สร้างไฟล์ใหม่ที่มีเนื้อหาเป็นออบเจกต์ว่าง
  usersData = {};
  fs.writeFileSync(path, JSON.stringify(usersData, null, 2));
}

function getUserData(userId) {
  return usersData[userId] || { credits: 0, codes: [] };
}

function saveUserData(userId, data) {
  usersData[userId] = data;
  fs.writeFile(path, JSON.stringify(usersData, null, 2), (err) => {
    if (err) {
      console.error(`Error writing ${path}:`, err);
    }
  });
}

function updateUserCredits(userId, amount) {
  let userData = getUserData(userId);
  let currentCredits = userData.credits || 0;

  // สมมติว่า 1 บาท = 1 เครดิต
  const newCredits = currentCredits + amount;

  userData.credits = newCredits;
  saveUserData(userId, userData);

  client.pushMessage(userId, { type: 'text', text: `💰 ยอดเครดิตปัจจุบันของคุณคือ ${newCredits} เครดิต` });
}

// เพิ่มรายการของแอดมิน
const adminIds = ['ADMIN_LINE_USER_ID']; // แทนที่ด้วย Line User ID ของแอดมิน

// ฟังก์ชันหลักในการจัดการอีเวนต์
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    // ไม่รองรับประเภทข้อความอื่นๆ
    return Promise.resolve(null);
  }

  const userId = event.source.userId;
  const message = event.message.text;
  
  // รับคำสั่งต่างๆ
  if (message.startsWith('/start')) {
    const replyText = '🤖 ยินดีต้อนรับสู่บอทสุดล้ำ! คุณสามารถใช้คำสั่งต่อไปนี้:\n\n' +
                      '💠 /addclient - เพิ่มลูกค้าใหม่\n' +
                      '💰 /topup - เติมเงินเพื่อซื้อเครดิต\n' +
                      '💳 /mycredits - ตรวจสอบเครดิตของคุณ\n' +
                      '📝 /mycodes - ดูโค้ดที่คุณสร้าง\n\n' +
                      '📌 โปรดใช้คำสั่ง /topup เพื่อเติมเครดิตก่อนใช้งาน';
    return client.replyMessage(event.replyToken, { type: 'text', text: replyText });
  
  } else if (message.startsWith('/topup')) {
    const replyText = '💳 กรุณาส่งลิงก์ซองอั่งเปาวอเลทเพื่อเติมเครดิตของคุณ!\n\n📥 ตัวอย่าง: https://gift.truemoney.com/campaign/?v=xxxxx';
    return client.replyMessage(event.replyToken, { type: 'text', text: replyText });
  
  } else if (message.startsWith('/mycredits')) {
    let userData = getUserData(userId);
    let credits = userData.credits || 0;
    return client.replyMessage(event.replyToken, { type: 'text', text: `💰 ยอดเครดิตปัจจุบันของคุณคือ ${credits} เครดิต` });
  
  } else if (message.startsWith('/mycodes')) {
    let userData = getUserData(userId);
    if (userData.codes && userData.codes.length > 0) {
      let response = '📜 คุณได้สร้างโค้ดดังต่อไปนี้:\n';
      userData.codes.forEach((codeEntry, index) => {
        response += `🔹 ${index + 1}. ${codeEntry.codeName} - สร้างเมื่อ ${codeEntry.creationDate}\n`;
      });
      return client.replyMessage(event.replyToken, { type: 'text', text: response });
    } else {
      return client.replyMessage(event.replyToken, { type: 'text', text: '❌ คุณยังไม่ได้สร้างโค้ดใดๆ' });
    }
  
  } else if (message.startsWith('/givecredits')) {
    if (adminIds.includes(userId)) {
      const replyOptions = {
        type: 'template',
        altText: 'กรุณาเลือกตัวเลือก',
        template: {
          type: 'buttons',
          title: 'เพิ่มเครดิต',
          text: 'กรุณาเลือกตัวเลือก:',
          actions: [
            { type: 'postback', label: 'เพิ่มให้ผู้ใช้', data: 'givecredits_to_user' },
            { type: 'postback', label: 'เพิ่มให้ตัวเอง', data: 'givecredits_to_self' }
          ]
        }
      };
      return client.replyMessage(event.replyToken, replyOptions);
    } else {
      return client.replyMessage(event.replyToken, { type: 'text', text: '🚫 คำสั่งนี้สำหรับแอดมินเท่านั้น' });
    }
  
  } else if (message.startsWith('/allcodes')) {
    if (adminIds.includes(userId)) {
      let response = '📄 รายการโค้ดทั้งหมด:\n';
      for (let uid in usersData) {
        if (usersData[uid].codes && usersData[uid].codes.length > 0) {
          response += `👤 ผู้ใช้ ${uid}:\n`;
          usersData[uid].codes.forEach((codeEntry, index) => {
            response += ` - ${codeEntry.codeName}: ${codeEntry.code}\n`;
          });
        }
      }
      return client.replyMessage(event.replyToken, { type: 'text', text: response });
    } else {
      return client.replyMessage(event.replyToken, { type: 'text', text: '🚫 คำสั่งนี้สำหรับแอดมินเท่านั้น' });
    }
  
  } else if (message.startsWith('/addclient')) {
    // ฟังก์ชันในการเพิ่มลูกค้าใหม่ผ่าน Line
    // คุณสามารถใช้ Flex Message หรือ Template Message เพื่อสร้าง UI แบบปุ่มได้
    const replyOptions = {
      type: 'template',
      altText: 'กรุณาเลือกโปรไฟล์ที่ต้องการ',
      template: {
        type: 'buttons',
        title: 'เลือกโปรไฟล์',
        text: 'กรุณาเลือกโปรไฟล์ที่ต้องการ:',
        actions: [
          { type: 'postback', label: '🚀 TRUE PRO เฟสบุค', data: 'true_pro_facebook' }
        ]
      }
    };
    userSessions[userId] = { step: 'ask_code_name', chatId: userId };
    return client.replyMessage(event.replyToken, replyOptions);
  
  } else if (message.includes('https://gift.truemoney.com/campaign/?v=')) {
    // จัดการลิงก์ซองอั่งเปา
    const codeMatch = message.match(/v=([a-zA-Z0-9]+)/);
    if (codeMatch && codeMatch[1]) {
      const code = codeMatch[1];
      processTrueMoneyGiftCode(userId, code);
    } else {
      return client.replyMessage(event.replyToken, { type: 'text', text: '⚠️ ลิงก์ไม่ถูกต้อง โปรดส่งลิงก์ซองอั่งเปาวอเลทที่ถูกต้อง' });
    }
  
  } else {
    // จัดการข้อความอื่นๆ
    if (message && !message.startsWith('/')) {
      return client.replyMessage(event.replyToken, { type: 'text', text: '❓ ไม่เข้าใจคำสั่งของคุณ โปรดใช้คำสั่งที่กำหนด' });
    }
  }

  // จัดการกระบวนการสนทนาเพิ่มเติมตาม userSessions
  if (userSessions[userId]) {
    const session = userSessions[userId];

    if (session.step === 'ask_code_name') {
      // เก็บชื่อโค้ด
      session.codeName = message;
      session.step = 'ask_days';
      return client.replyMessage(event.replyToken, { type: 'text', text: '📅 กรุณาเลือกจำนวนวันที่ต้องการ (1-30 วัน)' });
    
    } else if (session.step === 'ask_days') {
      const days = parseInt(message);
      if (isNaN(days) || days <= 0 || days > 30) {
        return client.replyMessage(event.replyToken, { type: 'text', text: '⚠️ กรุณาระบุจำนวนวันที่ถูกต้อง (1-30 วัน)' });
      } else {
        session.days = days;
        session.step = 'ask_gb_limit';
        return client.replyMessage(event.replyToken, { type: 'text', text: '💾 กรุณาระบุ GB ที่ต้องการจำกัด (หากไม่จำกัดพิมพ์ 0)' });
      }
    
    } else if (session.step === 'ask_gb_limit') {
      const gbLimit = parseInt(message);
      if (isNaN(gbLimit) || gbLimit < 0) {
        return client.replyMessage(event.replyToken, { type: 'text', text: '⚠️ กรุณาระบุจำนวน GB ที่ถูกต้อง' });
      } else {
        session.gbLimit = gbLimit;
        session.step = 'creating_code';
        
        // ส่งข้อความแอนิเมชัน (Line ไม่รองรับแอนิเมชันเช่น Telegram, ใช้ข้อความแทน)
        client.replyMessage(event.replyToken, { type: 'text', text: '⏳ กำลังสร้างโค้ดของคุณ โปรดรอสักครู่...' });

        // สร้างโค้ดหลังจาก 4 วินาที
        setTimeout(() => {
          let userData = getUserData(userId);
          let currentCredits = userData.credits || 0;
          const requiredCredits = session.days;

          if (currentCredits >= requiredCredits) {
            // หักเครดิตและเพิ่มลูกค้าใหม่
            const newCredits = currentCredits - requiredCredits;
            userData.credits = newCredits;
            saveUserData(userId, userData);

            // ทำการเข้าสู่ระบบและเพิ่มลูกค้าใหม่
            login(() => {
              addNewClient(session, (clientCode) => {
                // ส่งโค้ดไปยังผู้ใช้
                client.pushMessage(userId, { type: 'text', text: `✅ *โค้ดของคุณถูกสร้างสำเร็จ!*\n\n📬 กรุณาตรวจสอบโค้ดของคุณด้านล่าง:\n\n\`${clientCode}\``, emojis: [] });
                
                // อัปเดตข้อมูลผู้ใช้
                if (!userData.codes) {
                  userData.codes = [];
                }
                userData.codes.push({
                  code: clientCode,
                  codeName: session.codeName,
                  creationDate: new Date().toLocaleString()
                });
                saveUserData(userId, userData);

                client.pushMessage(userId, { type: 'text', text: '✅ โค้ดของคุณถูกสร้างและส่งเรียบร้อยแล้ว! โปรดตรวจสอบข้อความนี้ 📬' });

                delete userSessions[userId];
              }, (errorMsg) => {
                client.replyMessage(event.replyToken, { type: 'text', text: `🚫 เกิดข้อผิดพลาดในการสร้างโค้ด: ${errorMsg}` });
                delete userSessions[userId];
              });
            });
          } else {
            client.replyMessage(event.replyToken, { type: 'text', text: `⚠️ เครดิตของคุณไม่เพียงพอ คุณมี ${currentCredits} เครดิต แต่ต้องการ ${requiredCredits} เครดิต\nโปรดเติมเครดิตโดยใช้คำสั่ง /topup` });
            delete userSessions[userId];
          }
        }, 4000); // รอ 4 วินาทีเพื่อจำลองเวลาประมวลผล
      }
    } else if (session.step === 'givecredits_ask_user') {
      // จัดการการให้เครดิตให้ผู้ใช้
      // เนื่องจาก Line ไม่รองรับการตอบกลับเช่น Telegram คุณอาจต้องใช้วิธีอื่น เช่น การระบุ User ID
      return client.replyMessage(event.replyToken, { type: 'text', text: '🔍 กรุณาระบุ User ID ของผู้ใช้ที่ต้องการเพิ่มเครดิตให้' });
    
    } else if (session.step === 'givecredits_ask_amount') {
      const amount = parseInt(message);
      if (isNaN(amount) || amount <= 0) {
        return client.replyMessage(event.replyToken, { type: 'text', text: '⚠️ กรุณาระบุจำนวนเครดิตที่ถูกต้อง' });
      } else {
        const targetUserId = session.targetUserId.toString();
        let targetUserData = getUserData(targetUserId);
        let currentCredits = targetUserData.credits || 0;
        targetUserData.credits = currentCredits + amount;
        saveUserData(targetUserId, targetUserData);

        client.replyMessage(event.replyToken, { type: 'text', text: `✅ เพิ่มเครดิตให้กับผู้ใช้ ${targetUserId} จำนวน ${amount} เครดิตแล้ว` });

        if (targetUserId !== userId.toString()) {
          // แจ้งเตือนผู้ใช้เป้าหมายในแชทส่วนตัว
          client.pushMessage(targetUserId, { type: 'text', text: `💰 คุณได้รับเครดิตเพิ่ม ${amount} เครดิต จากแอดมิน` })
            .catch((error) => {
              console.error('Error notifying target user:', error);
            });
        }
        delete userSessions[userId];
      }
    }
  }
}

// ฟังก์ชันสำหรับส่งโค้ดไปยังผู้ใช้
function sendCodeToUser(userId, clientCode, session) {
  // ส่งโค้ดไปยังแชทส่วนตัวของผู้ใช้
  client.pushMessage(userId, {
    type: 'text',
    text: `✅ *โค้ดของคุณถูกสร้างสำเร็จ!*\n\n📬 กรุณาตรวจสอบโค้ดของคุณด้านล่าง:\n\n\`${clientCode}\``,
    emojis: []
  })
  .then(() => {
    // หลังจากส่งโค้ดสำเร็จ อัปเดตข้อมูลผู้ใช้
    const userIdStr = userId.toString();
    let userData = getUserData(userIdStr);
    if (!userData.codes) {
      userData.codes = [];
    }
    userData.codes.push({
      code: clientCode,
      codeName: session.codeName,
      creationDate: new Date().toLocaleString()
    });
    saveUserData(userIdStr, userData);
  })
  .catch((error) => {
    if (error.statusCode === 403) {
      // ผู้ใช้ยังไม่ได้เริ่มแชทกับบอท
      const replyOptions = {
        type: 'template',
        altText: 'เริ่มแชทกับบอท',
        template: {
          type: 'buttons',
          text: 'กรุณากดปุ่มด้านล่างเพื่อเริ่มแชทส่วนตัวกับบอท',
          actions: [
            { type: 'uri', label: 'เริ่มแชทกับบอท', uri: `https://line.me/R/ti/p/${config.channelAccessToken}` }
          ]
        }
      };
      client.pushMessage(userId, replyOptions);
    } else {
      console.error('Error sending code to user:', error);
    }
  });
}
