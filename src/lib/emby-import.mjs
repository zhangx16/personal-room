// Parse locally only. Never send pasted account messages to an external service.
export function parseEmbyMessage(input) {
  const lines=input.replace(/\r/g,'').split('\n');
  function field(labels) {
    for(const line of lines) {
      const match=line.match(new RegExp('^\\s*[·•▎>*-]*\\s*(?:'+labels.join('|')+')\\s*[|｜:：]\\s*(.+)$','i'));
      if(match) return match[1].trim().replace(/[（(]仅发送一次[）)]\s*$/,'').replace(/^[_*`]+|[_*`]+$/g,'').trim();
    }
    return '';
  }
  const urls=[...new Set((input.match(/https?:\/\/[^\s<>「」【】]+/gi)||[]).map(raw=>raw.replace(/[。；;，,）)]+$/,'')))].filter(raw=>{try{return ['http:','https:'].includes(new URL(raw).protocol);}catch{return false;}});
  return {
    username:field(['用户名称','用户名','用户账号','账号','帳號']),
    password:field(['用户密码','登录密码','登入密码','密码']),
    securityCode:field(['安全密码','安全码','安全碼']),
    expiry:field(['到期时间','到期日期','有效期','到期']),
    urls,
  };
}
