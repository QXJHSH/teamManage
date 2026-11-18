const DEFAULT_SPREADSHEET_ID = '15zw5HdajgYVGS4odRv8qQeoPPtItgM04bTMOQACsqGg';
const FIRESTORE_TEAM_STATE_URL = 'https://firestore.googleapis.com/v1/projects/frc10114-team-manage/databases/(default)/documents/frc10114_teams/team_state';

function unwrapFirestoreValue(val) {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return val.doubleValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(unwrapFirestoreValue);
  if ('mapValue' in val) {
    const obj = {};
    for (const k of Object.keys(val.mapValue.fields || {})) {
      obj[k] = unwrapFirestoreValue(val.mapValue.fields[k]);
    }
    return obj;
  }
  return null;
}

function extractClassCode(className) {
  if (!className) return '';
  const str = String(className).trim();
  const seniorMatch = str.match(/高([一二三123])(\d{1,2})班?/);
  if (seniorMatch) {
    const gradeMap = { '一': '1', '1': '1', '二': '2', '2': '2', '三': '3', '3': '3' };
    const grade = gradeMap[seniorMatch[1]] || seniorMatch[1];
    const cls = String(seniorMatch[2]).padStart(2, '0');
    return `${grade}${cls}`;
  }
  const numMatch = str.match(/^(\d{3,4})班?$/);
  if (numMatch) return numMatch[1];
  if (/\d/.test(str)) return str.replace(/班$/, '');
  return str;
}

function formatStudentWithClass(studentName, studentId, membersList) {
  const m = (membersList || []).find(x => x.id === studentId || x.name === studentName);
  const code = m ? extractClassCode(m.className) : '';
  const seatNum = m && m.seatNumber ? String(m.seatNumber).replace(/\D/g, '') : '';
  const seatStr = seatNum ? seatNum.padStart(2, '0') : '';
  if (code && seatStr) {
    if (code.endsWith(seatStr) && code.length >= 5) return `${code}${studentName}`;
    return `${code}${seatStr}${studentName}`;
  }
  if (code) return `${code}${studentName}`;
  return studentName;
}

function sortStudentsByClassOrder(studentItems, membersList) {
  return [...studentItems].sort((a, b) => {
    const mA = (membersList || []).find(x => x.id === a.studentId || x.name === a.studentName);
    const mB = (membersList || []).find(x => x.id === b.studentId || x.name === b.studentName);
    const codeA = mA ? extractClassCode(mA.className) : '';
    const codeB = mB ? extractClassCode(mB.className) : '';
    const numA = parseInt(codeA, 10);
    const numB = parseInt(codeB, 10);
    const hasNumA = !isNaN(numA) && numA > 0;
    const hasNumB = !isNaN(numB) && numB > 0;
    const cleanSeat = (s) => {
      if (!s) return NaN;
      const digits = String(s).replace(/\D/g, '');
      return digits ? parseInt(digits, 10) : NaN;
    };
    const seatA = cleanSeat(mA && mA.seatNumber);
    const seatB = cleanSeat(mB && mB.seatNumber);
    if (hasNumA && hasNumB) {
      if (numA !== numB) return numA - numB;
      if (!isNaN(seatA) && !isNaN(seatB)) {
        if (seatA !== seatB) return seatA - seatB;
      } else if (!isNaN(seatA)) return -1;
      else if (!isNaN(seatB)) return 1;
      return (a.studentName || '').localeCompare(b.studentName || '', 'zh-Hant');
    }
    if (hasNumA && !hasNumB) return -1;
    if (!hasNumA && hasNumB) return 1;
    if (codeA !== codeB) return (codeA || '').localeCompare(codeB || '');
    if (!isNaN(seatA) && !isNaN(seatB)) {
      if (seatA !== seatB) return seatA - seatB;
    } else if (!isNaN(seatA)) return -1;
    else if (!isNaN(seatB)) return 1;
    return (a.studentName || '').localeCompare(b.studentName || '', 'zh-Hant');
  });
}

async function fetchAndBuildTomorrowPayload(customDate) {
  const taipeiTomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const targetDate = customDate || taipeiTomorrow.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
  const fsRes = await fetch(FIRESTORE_TEAM_STATE_URL);
  if (!fsRes.ok) {
    throw new Error(`無法讀取雲端考勤資料庫 (HTTP ${fsRes.status})`);
  }
  const fsJson = await fsRes.json();
  const fields = fsJson.fields || {};
  const members = unwrapFirestoreValue(fields.members) || [];
  const attendance = unwrapFirestoreValue(fields.attendance) || [];
  const targetRecords = attendance.filter(r => r && r.date === targetDate && r.type === 'attendance');

  const morning = sortStudentsByClassOrder(targetRecords.filter(r => (r.slots || []).includes('morning')), members);
  const afternoon = sortStudentsByClassOrder(targetRecords.filter(r => (r.slots || []).includes('afternoon')), members);
  const evening = sortStudentsByClassOrder(targetRecords.filter(r => (r.slots || []).includes('evening')), members);

  const morningNames = [...new Set(morning.map(r => formatStudentWithClass(r.studentName, r.studentId, members)))];
  const afternoonNames = [...new Set(afternoon.map(r => formatStudentWithClass(r.studentName, r.studentId, members)))];
  const eveningNames = [...new Set(evening.map(r => formatStudentWithClass(r.studentName, r.studentId, members)))];

  const periodSections = [];
  if (morningNames.length > 0) periodSections.push(`⛅ 上午 (09-12點)：\n${morningNames.join('\n')}`);
  if (afternoonNames.length > 0) periodSections.push(`☀️ 下午 (13-17點)：\n${afternoonNames.join('\n')}`);
  if (eveningNames.length > 0) periodSections.push(`🌙 晚上 (18-21點)：\n${eveningNames.join('\n')}`);

  let fullText = `📢 【明日申請在校學習名單】\n📅 日期：${targetDate}\n\n明日申請在校人員如下：\n`;
  if (periodSections.length > 0) {
    fullText += periodSections.join('\n\n');
  } else {
    fullText += '無人申請留校';
  }

  return {
    date: targetDate,
    morning: morningNames.length > 0 ? morningNames.join('、') : '無人申請',
    afternoon: afternoonNames.length > 0 ? afternoonNames.join('、') : '無人申請',
    evening: eveningNames.length > 0 ? eveningNames.join('、') : '',
    fullText,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }

  try {
    const body = req.method === 'POST'
      ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}))
      : {};
    const envWebhookUrl = (process.env.GAS_WEBHOOK_URL || '').trim();
    const envSpreadsheetId = (process.env.GOOGLE_SPREADSHEET_ID || '').trim();
    const envWebhookSecret = (process.env.GAS_WEBHOOK_SECRET || '').trim();

    const targetWebhookUrl = envWebhookUrl || (typeof body.webhookUrl === 'string' ? body.webhookUrl.trim() : '');
    if (!targetWebhookUrl) {
      return res.status(400).json({
        status: 'error',
        message: '後端尚未設定 GAS_WEBHOOK_URL 環境變數，請於 Vercel 後台設定或於管理介面提供 Webhook 網址'
      });
    }

    if (!/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec(\?.*)?$/.test(targetWebhookUrl)) {
      return res.status(400).json({
        status: 'error',
        message: '安全攔截：僅允許轉發至官方 Google Apps Script 網域 (https://script.google.com/macros/s/.../exec)'
      });
    }

    let resolvedPayload = body;
    if (!resolvedPayload.fullText) {
      resolvedPayload = await fetchAndBuildTomorrowPayload(body.date);
    }

    const forwardPayload = {
      spreadsheetId: envSpreadsheetId || body.spreadsheetId || DEFAULT_SPREADSHEET_ID,
      date: resolvedPayload.date || '',
      morning: resolvedPayload.morning || '',
      afternoon: resolvedPayload.afternoon || '',
      evening: resolvedPayload.evening || '',
      fullText: resolvedPayload.fullText || '',
      submittedAt: body.submittedAt || new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
      ...(envWebhookSecret ? { token: envWebhookSecret } : {}),
    };

    const gasResponse = await fetch(targetWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(forwardPayload),
      redirect: 'follow',
    });

    if (!gasResponse.ok) {
      return res.status(502).json({
        status: 'error',
        message: `Google Apps Script 回應異常 (HTTP ${gasResponse.status})`
      });
    }

    const text = await gasResponse.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      parsed = null;
    }

    if (parsed && parsed.status === 'error') {
      return res.status(502).json({
        status: 'error',
        message: parsed.message || '試算表腳本執行失敗'
      });
    }

    return res.status(200).json({
      status: 'success',
      verified: Boolean(parsed && parsed.status === 'success'),
      rawStatus: gasResponse.status
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: err?.message || '後端代理連線失敗，請檢查網路連線'
    });
  }
}
