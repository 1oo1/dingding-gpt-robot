import crypto from "crypto"
import { Buffer } from 'buffer';

function sign(timestamp, secretKey) {
  let string_to_sign = timestamp + '\n' + secretKey;
  let hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(string_to_sign);

  let hmac_code = hmac.digest();

  return Buffer.from(hmac_code).toString('base64');
}

async function makeAiRequestBody(content) {
  const payload = {
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content:
          "You are ChatGPT, a large language model trained by OpenAI. Follow the user's instructions carefully. Respond using markdown chinese",
      },
      {
        role: 'user',
        content: content,
      },
    ],
  };

  return JSON.stringify(payload);
}

function makeErrorBody(message, receivedMessage) {
  return JSON.stringify({
    msgtype: 'text',
    text: {
      content: `@${receivedMessage.senderStaffId} \nSorry，出错了。 \n ${message}.`,
    },
    at: {
      atUserIds: [receivedMessage.senderStaffId],
      isAtAll: false
    }
  });
}

async function makeBody(aiRes, receivedMessage) {
  const aiResJson = await aiRes.json();
  return JSON.stringify({
    msgtype: 'markdown',
    markdown: {
      title: `Robot @${receivedMessage.senderNick}`,
      text: `@${receivedMessage.senderStaffId} \n\n${aiResJson.choices?.[0].message?.content}`,
    },
    at: {
      atUserIds: [receivedMessage.senderStaffId],
      isAtAll: false
    },
  });
}

async function verifyDingRequest(request) {
  const timestamp = request.headers['timestamp'];
  const requestSign = request.headers['sign'];

  // verify timestamp less than 1 hour
  if (!timestamp || !requestSign || Date.now() - Number(timestamp) > 60 * 60 * 1000) {
    return false;
  }

  const localSign = await sign(timestamp, process.env.D_KEY);
  return localSign === requestSign;
}

async function sendToDing(request) {
  const receivedMsg = request.body;
  let message = '';

  // console.log('---- receivedMsg:', receivedMsg);

  try {
    const aiBody = await makeAiRequestBody(receivedMsg.text.content);
    const res = await fetch('https://ai.fakeopen.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.O_FK}`,
      },
      body: aiBody,
    });

    if (!res.ok) {
      message = makeErrorBody(`Resposne: ${res.status} ${await res.text()}`, receivedMsg);
    } else {
      message = await makeBody(res, receivedMsg);
    }
  } catch (error) {
    message = makeErrorBody(`Request OpenAI failed: ${error.message}`, receivedMsg);
  }

  // const timestamp = Date.now();
  // const hookSign = sign(timestamp, process.env.D_HOOK_KEY);
  // const url = `${process.env.D_HOOK_URL}&timestamp=${timestamp}&sign=${hookSign}`

  const url = 'https://oapi.dingtalk.com/robot/send?access_token=9e1e9c26fe55f3507fdf0d603582a4852d7fcd4f925b7cff773716b542ae307a';

  // console.log('---- chatGPT msg:', message);
  const result = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: message,
  });

  // console.log('------ ding res:', result.status, await result.text());
}

export default async function handler(req) {
  if (await verifyDingRequest(req)) {
    sendToDing(req)
  }
}