import crypto from "crypto"
import { Buffer } from 'buffer';
import kvStore from './KVUtil.js';

function sign(timestamp, secretKey) {
  let string_to_sign = timestamp + '\n' + secretKey;
  let hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(string_to_sign);

  let hmac_code = hmac.digest();

  return Buffer.from(hmac_code).toString('base64');
}

async function makeAiRequestBody(content, senderStaffId) {
  const conversationList = kvStore.get(senderStaffId) || [];

  const payload = {
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content:
          "You are ChatGPT, a large language model trained by OpenAI. Follow the user's instructions carefully. Respond using markdown chinese",
      },
      ...conversationList,
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
  const aiResText = aiResJson.choices?.[0].message?.content ?? 'empty msg.';

  // store the conversation list by senderStaffId
  const conversationList = kvStore.get(receivedMessage.senderStaffId) || [];
  conversationList.push({
    role: 'user',
    content: receivedMessage.text.content,
  });
  conversationList.push({
    role: 'assistant',
    content: aiResText,
  });
  // remove old if more than 10 (5 conversations)
  if (conversationList.length > 10) {
    conversationList.splice(0, conversationList.length - 10);
  }
  kvStore.set(receivedMessage.senderStaffId, conversationList, 1000 * 60 * 60 * 24);

  return JSON.stringify({
    msgtype: 'markdown',
    markdown: {
      title: `Robot @${receivedMessage.senderNick}`,
      text: `@${receivedMessage.senderStaffId} \n\n ${aiResText}`,
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
    const aiBody = await makeAiRequestBody(receivedMsg.text.content, receivedMsg.senderStaffId);
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
  
  // console.log('---- chatGPT url:', process.env.D_HOOK_URL)
  // console.log('---- chatGPT msg:', message);

  const result = await fetch(process.env.D_HOOK_URL, {
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