// นำเข้าโมดูลที่จำเป็น
const TelegramBot = require('node-telegram-bot-api');
const request = require('request').defaults({ jar: true });
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// ใส่โทเคนบอท Telegram ของคุณที่นี่
const token = ''; // แทนที่ด้วยโทเคนของคุณ

// สร้างบอทที่ใช้ 'polling' ในการรับข้อความใหม่
const bot = new TelegramBot(token, { polling: true });

// เก็บสถานะของผู้ใช้ในการสนทนา
const userSessions = {};

// เบอร์มือถือที่ใช้ในการรับเงิน
const mobileNumber = '0825658423';

// เก็บชื่อผู้ใช้ของบอท
let botUsername = '';
bot.getMe().then((botInfo) => {
  botUsername = botInfo.username;
});

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
    url: '/GaKtR4zXrqhyIpG/login',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    form: {
      'username': '',
      'password': ''
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
    url: '/GaKtR4zXrqhyIpG/panel/api/inbounds/addClient',
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
function processTrueMoneyGiftCode(chatId, code) {
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
      bot.sendMessage(chatId, '🚫 เกิดข้อผิดพลาดในการรับเงิน โปรดลองใหม่อีกครั้ง');
      return;
    }

    if (response.statusCode === 200) {
      // แปลงข้อมูลการตอบกลับเพื่อรับจำนวนเงิน
      try {
        const body = JSON.parse(response.body);
        if (body && body.data && body.data.my_ticket && body.data.my_ticket.amount_baht) {
          const amount = parseFloat(body.data.my_ticket.amount_baht);
          bot.sendMessage(chatId, `✅ รับเงินจำนวน ${amount} บาท เรียบร้อยแล้ว! ขอบคุณที่โดเนทครับ 🙏`);
          // อัปเดตเครดิตของผู้ใช้
          updateUserCredits(chatId, amount);
        } else {
          bot.sendMessage(chatId, '🚫 เกิดข้อผิดพลาดในการรับข้อมูลจำนวนเงิน');
        }
      } catch (e) {
        console.error('Error parsing response:', e);
        bot.sendMessage(chatId, '🚫 เกิดข้อผิดพลาดในการประมวลผลข้อมูล');
      }

    } else {
      console.log('Response:', response.body);
      bot.sendMessage(chatId, '🚫 เกิดข้อผิดพลาดในการรับเงิน โปรดตรวจสอบลิงก์และลองใหม่อีกครั้ง');
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

function updateUserCredits(chatId, amount) {
  const userId = chatId.toString();
  let userData = getUserData(userId);
  let currentCredits = userData.credits || 0;

  // สมมติว่า 1 บาท = 1 เครดิต
  const newCredits = currentCredits + amount;

  userData.credits = newCredits;
  saveUserData(userId, userData);

  bot.sendMessage(chatId, `💰 ยอดเครดิตปัจจุบันของคุณคือ ${newCredits} เครดิต`);
}

// เพิ่มรายการของแอดมิน
const adminIds = [123456789]; // แทนที่ด้วย Telegram ID ของแอดมิน

// รับคำสั่ง /start จากผู้ใช้
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const message = '🤖 ยินดีต้อนรับสู่บอทสุดล้ำ! คุณสามารถใช้คำสั่งต่อไปนี้:\n\n' +
                  '💠 /addclient - เพิ่มลูกค้าใหม่\n' +
                  '💰 /topup - เติมเงินเพื่อซื้อเครดิต\n' +
                  '💳 /mycredits - ตรวจสอบเครดิตของคุณ\n' +
                  '📝 /mycodes - ดูโค้ดที่คุณสร้าง\n\n' +
                  '📌 โปรดใช้คำสั่ง /topup เพื่อเติมเครดิตก่อนใช้งาน';
  bot.sendMessage(chatId, message);
});

// รับคำสั่ง /topup จากผู้ใช้
bot.onText(/\/topup/, (msg) => {
  const chatId = msg.chat.id;
  if (msg.chat.type === 'private') {
    const message = '💳 กรุณาส่งลิงก์ซองอั่งเปาวอเลทเพื่อเติมเครดิตของคุณ!\n\n📥 ตัวอย่าง: https://gift.truemoney.com/campaign/?v=xxxxx';
    bot.sendMessage(chatId, message);
  } else {
    bot.sendMessage(chatId, '⚠️ กรุณาใช้คำสั่งนี้ในแชทส่วนตัวกับบอทเท่านั้น');
  }
});

// รับคำสั่ง /mycredits
bot.onText(/\/mycredits/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  let userData = getUserData(userId);
  let credits = userData.credits || 0;
  bot.sendMessage(chatId, `💰 ยอดเครดิตปัจจุบันของคุณคือ ${credits} เครดิต`);
});

// รับคำสั่ง /mycodes
bot.onText(/\/mycodes/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  let userData = getUserData(userId);
  if (userData.codes && userData.codes.length > 0) {
    let response = '📜 คุณได้สร้างโค้ดดังต่อไปนี้:\n';
    userData.codes.forEach((codeEntry, index) => {
      response += `🔹 ${index + 1}. ${codeEntry.codeName} - สร้างเมื่อ ${codeEntry.creationDate}\n`;
    });
    bot.sendMessage(chatId, response);
  } else {
    bot.sendMessage(chatId, '❌ คุณยังไม่ได้สร้างโค้ดใดๆ');
  }
});

// รับคำสั่ง /givecredits สำหรับแอดมิน
bot.onText(/\/givecredits/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (adminIds.includes(userId)) {
    const options = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'เพิ่มให้ผู้ใช้', callback_data: 'givecredits_to_user' }],
          [{ text: 'เพิ่มให้ตัวเอง', callback_data: 'givecredits_to_self' }]
        ]
      }
    };
    bot.sendMessage(chatId, '🔧 กรุณาเลือกตัวเลือก:', options);
  } else {
    bot.sendMessage(chatId, '🚫 คำสั่งนี้สำหรับแอดมินเท่านั้น');
  }
});

// รับคำสั่ง /allcodes สำหรับแอดมิน
bot.onText(/\/allcodes/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
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
    bot.sendMessage(chatId, response);
  } else {
    bot.sendMessage(chatId, '🚫 คำสั่งนี้สำหรับแอดมินเท่านั้น');
  }
});

// รับคำสั่ง /addclient
bot.onText(/\/addclient/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // ตรวจสอบว่าเป็นกลุ่มที่กำหนดหรือไม่
  if (chatId === -1002344075247) {
    // ส่งปุ่ม 'TRUE PRO เฟสบุค'
    const options = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚀 TRUE PRO เฟสบุค', callback_data: 'true_pro_facebook' }]
        ]
      }
    };
    bot.sendMessage(chatId, '🔍 กรุณาเลือกโปรไฟล์ที่ต้องการ:', options);
  } else {
    bot.sendMessage(chatId, '⚠️ คำสั่งนี้สามารถใช้ได้เฉพาะในกลุ่มที่กำหนดเท่านั้น');
  }
});

// จัดการการกดปุ่ม
bot.on('callback_query', (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;

  if (data === 'true_pro_facebook') {
    // เริ่มต้นการสนทนาเพื่อเก็บข้อมูล
    userSessions[userId] = { step: 'ask_code_name' };

    bot.sendMessage(chatId, '📝 กรุณาตั้งชื่อโค้ดของคุณ');
  } else if (data === 'givecredits_to_user') {
    if (adminIds.includes(userId)) {
      userSessions[userId] = { step: 'givecredits_ask_user' };
      bot.sendMessage(chatId, '🔍 กรุณาตอบกลับข้อความของผู้ใช้ที่ต้องการเพิ่มเครดิตให้');
    } else {
      bot.answerCallbackQuery(callbackQuery.id, '🚫 คำสั่งนี้สำหรับแอดมินเท่านั้น');
    }
  } else if (data === 'givecredits_to_self') {
    if (adminIds.includes(userId)) {
      userSessions[userId] = { step: 'givecredits_ask_amount', targetUserId: userId };
      bot.sendMessage(chatId, '💰 กรุณาระบุจำนวนเครดิตที่ต้องการเพิ่มให้ตัวเอง');
    } else {
      bot.answerCallbackQuery(callbackQuery.id, '🚫 คำสั่งนี้สำหรับแอดมินเท่านั้น');
    }
  }
});

// จัดการข้อความจากผู้ใช้
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  // หากผู้ใช้อยู่ในสถานะการสนทนา
  if (userSessions[userId]) {
    const session = userSessions[userId];

    // เก็บ message IDs
    if (!session.messageIds) {
      session.messageIds = [];
    }
    session.messageIds.push(msg.message_id);

    if (session.step === 'ask_code_name') {
      // เก็บชื่อโค้ด
      session.codeName = text;
      session.step = 'ask_days';
      bot.sendMessage(chatId, '📅 กรุณาเลือกจำนวนวันที่ต้องการ (1-30 วัน)');
    } else if (session.step === 'ask_days') {
      const days = parseInt(text);
      if (isNaN(days) || days <= 0 || days > 30) {
        bot.sendMessage(chatId, '⚠️ กรุณาระบุจำนวนวันที่ถูกต้อง (1-30 วัน)');
      } else {
        session.days = days;
        session.step = 'ask_gb_limit';
        bot.sendMessage(chatId, '💾 กรุณาระบุ GB ที่ต้องการจำกัด (หากไม่จำกัดพิมพ์ 0)');
      }
    } else if (session.step === 'ask_gb_limit') {
      const gbLimit = parseInt(text);
      if (isNaN(gbLimit) || gbLimit < 0) {
        bot.sendMessage(chatId, '⚠️ กรุณาระบุจำนวน GB ที่ถูกต้อง');
      } else {
        session.gbLimit = gbLimit;
        session.step = 'creating_code';
        bot.sendMessage(chatId, '⏳ กำลังสร้างโค้ดของคุณ โปรดรอสักครู่...');

        // ส่ง GIF
        const gifUrl = "https://i.imgur.com/DnLmp0s.gif";
        bot.sendAnimation(chatId, gifUrl);

        // สร้างโค้ดหลังจาก 4 วินาที
        setTimeout(() => {
          const userIdStr = userId.toString();
          let userData = getUserData(userIdStr);
          let currentCredits = userData.credits || 0;

          const requiredCredits = session.days;

          if (currentCredits >= requiredCredits) {
            // หักเครดิตและเพิ่มลูกค้าใหม่
            const newCredits = currentCredits - requiredCredits;

            userData.credits = newCredits;
            saveUserData(userIdStr, userData);

            // ทำการเพิ่มลูกค้าใหม่
            login(() => {
              addNewClient(session, (clientCode) => {
                // ส่งโค้ดไปยังแชทส่วนตัวของผู้ใช้
                sendCodeToUser(userId, chatId, clientCode, session, msg);
                // delete userSessions[userId]; // Will be deleted in sendCodeToUser
              }, (errorMsg) => {
                bot.sendMessage(chatId, '🚫 เกิดข้อผิดพลาดในการสร้างโค้ด: ' + errorMsg);
                delete userSessions[userId];
              });
            });
          } else {
            bot.sendMessage(chatId, `⚠️ เครดิตของคุณไม่เพียงพอ คุณมี ${currentCredits} เครดิต แต่ต้องการ ${requiredCredits} เครดิต\nโปรดเติมเครดิตโดยใช้คำสั่ง /topup`);
            delete userSessions[userId];
          }
        }, 4000); // รอ 4 วินาทีเพื่อจำลองเวลาประมวลผล
      }
    } else if (session.step === 'givecredits_ask_user') {
      if (msg.reply_to_message && msg.reply_to_message.from) {
        const targetUserId = msg.reply_to_message.from.id;
        session.targetUserId = targetUserId;
        session.step = 'givecredits_ask_amount';
        bot.sendMessage(chatId, '💰 กรุณาระบุจำนวนเครดิตที่ต้องการเพิ่มให้ผู้ใช้');
      } else {
        bot.sendMessage(chatId, '⚠️ กรุณาตอบกลับข้อความของผู้ใช้ที่ต้องการเพิ่มเครดิตให้');
      }
    } else if (session.step === 'givecredits_ask_amount') {
      const amount = parseInt(text);
      if (isNaN(amount) || amount <= 0) {
        bot.sendMessage(chatId, '⚠️ กรุณาระบุจำนวนเครดิตที่ถูกต้อง');
      } else {
        const targetUserId = session.targetUserId.toString();
        let targetUserData = getUserData(targetUserId);
        let currentCredits = targetUserData.credits || 0;
        targetUserData.credits = currentCredits + amount;
        saveUserData(targetUserId, targetUserData);

        bot.sendMessage(chatId, `✅ เพิ่มเครดิตให้กับผู้ใช้ ${targetUserId} จำนวน ${amount} เครดิตแล้ว`);

        if (targetUserId !== userId.toString()) {
          // Notify target user in private chat
          bot.sendMessage(targetUserId, `💰 คุณได้รับเครดิตเพิ่ม ${amount} เครดิต จากแอดมิน`);
        }
        delete userSessions[userId];
      }
    }
  } else if (msg.chat.type === 'private') {
    // จัดการข้อความในแชทส่วนตัว

    // จัดการลิงก์ซองอั่งเปา
    if (text && text.includes('https://gift.truemoney.com/campaign/?v=')) {
      // ตรวจสอบว่ามีลิงก์ซองอั่งเปาหรือไม่
      const codeMatch = text.match(/v=([a-zA-Z0-9]+)/);
      if (codeMatch && codeMatch[1]) {
        const code = codeMatch[1];

        // ทำการเรียก API เพื่อรับเงิน
        processTrueMoneyGiftCode(chatId, code);
      } else {
        bot.sendMessage(chatId, '⚠️ ลิงก์ไม่ถูกต้อง โปรดส่งลิงก์ซองอั่งเปาวอเลทที่ถูกต้อง');
      }
    }
  } else {
    // ไม่ตอบสนองต่อข้อความอื่นๆ ในกลุ่ม
    if (text && !text.startsWith('/')) {
      bot.sendMessage(chatId, '❓ ไม่เข้าใจคำสั่งของคุณ โปรดใช้คำสั่งที่กำหนด');
    }
  }
});

// ฟังก์ชันสำหรับส่งโค้ดไปยังผู้ใช้
function sendCodeToUser(userId, chatId, clientCode, session, msg) {
  // ส่งโค้ดไปยังแชทส่วนตัวของผู้ใช้
  bot.sendMessage(userId, `✅ โค้ดของคุณถูกสร้างสำเร็จ!\n\n📬 กรุณาตรวจสอบโค้ดของคุณด้านล่าง:\n\n${clientCode}`)
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

      // แจ้งเตือนในกลุ่ม
      bot.sendMessage(chatId, '✅ โค้ดของคุณถูกส่งไปยังแชทส่วนตัวแล้ว! โปรดตรวจสอบแชทส่วนตัวของคุณ 📬');

      // ลบข้อความในการสนทนา
      if (session && session.messageIds) {
        session.messageIds.forEach((messageId) => {
          bot.deleteMessage(chatId, messageId).catch((error) => {
            console.error('Error deleting message:', error);
          });
        });
      }
      delete userSessions[userId];
    })
    .catch((error) => {
      if (error.response && error.response.statusCode === 403) {
        // ผู้ใช้ยังไม่ได้เริ่มแชทกับบอท
        const options = {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'เริ่มแชทกับบอท', url: `https://t.me/${botUsername}?start` }]
            ]
          }
        };
        const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
        // ส่งข้อความในกลุ่ม
        bot.sendMessage(chatId, `${username} กรุณากดปุ่มด้านล่างเพื่อเริ่มแชทส่วนตัวกับบอท`, options);
      } else {
        console.error('Error sending code to user:', error);
      }
    });
}
