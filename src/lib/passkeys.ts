import { api } from "./api";
const from64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")), c=>c.charCodeAt(0));
const to64 = (value: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
type AuthOptions = Omit<PublicKeyCredentialRequestOptions,"challenge"|"allowCredentials"> & {challenge:string;allowCredentials?:Array<{id:string;type:PublicKeyCredentialType;transports?:AuthenticatorTransport[]}>};
type RegisterOptions = Omit<PublicKeyCredentialCreationOptions,"challenge"|"user"|"excludeCredentials"> & {challenge:string;user:Omit<PublicKeyCredentialUserEntity,"id">&{id:string};excludeCredentials?:Array<{id:string;type:PublicKeyCredentialType;transports?:AuthenticatorTransport[]}>};
type PRFResult = AuthenticationExtensionsClientOutputs & { prf?: { results?: { first: ArrayBuffer } } };
export async function deviceAuthenticate(prfSalt?: Uint8Array, credentialId?: string) {
  const options=await api<AuthOptions>("passkey/options",{});
  const extensions = prfSalt ? { prf: { eval: { first: prfSalt } } } : {};
  const credential=await navigator.credentials.get({publicKey:{...options,challenge:from64(options.challenge),allowCredentials:credentialId?[{id:from64(credentialId),type:"public-key"}]:options.allowCredentials?.map(c=>({...c,id:from64(c.id)})),extensions:extensions as AuthenticationExtensionsClientInputs}}) as PublicKeyCredential|null;
  if(!credential)throw new Error("设备验证已取消");
  const response=credential.response as AuthenticatorAssertionResponse;
  // Never send PRF output to the server. It is local encryption key material.
  await api("passkey/verify",{id:credential.id,rawId:to64(credential.rawId),type:credential.type,response:{authenticatorData:to64(response.authenticatorData),clientDataJSON:to64(response.clientDataJSON),signature:to64(response.signature),userHandle:response.userHandle?to64(response.userHandle):null},clientExtensionResults:{}});
  return {id:credential.id,prf:(credential.getClientExtensionResults() as PRFResult).prf?.results?.first};
}
export async function registerDevice(password:string,code:string,name:string) {
  const options=await api<RegisterOptions>("passkeys/register-options",{password,code});
  const credential=await navigator.credentials.create({publicKey:{...options,challenge:from64(options.challenge),user:{...options.user,id:from64(options.user.id)},excludeCredentials:options.excludeCredentials?.map(c=>({...c,id:from64(c.id)})),extensions:{prf:{}} as AuthenticationExtensionsClientInputs}}) as PublicKeyCredential|null;
  if(!credential)throw new Error("设备绑定已取消");
  const response=credential.response as AuthenticatorAttestationResponse;
  await api("passkeys/register-verify",{name,credential:{id:credential.id,rawId:to64(credential.rawId),type:credential.type,response:{clientDataJSON:to64(response.clientDataJSON),attestationObject:to64(response.attestationObject),transports:response.getTransports()},clientExtensionResults:{}}});
}
type Wrapper={id:string;salt:string;iv:string;data:string};
const wrapperName=(recordId:string)=>`dev-room-device:${recordId}`;
export function hasDeviceUnlock(recordId:string){try{return !!localStorage.getItem(wrapperName(recordId));}catch{return false;}}
export function forgetDeviceUnlock(recordId:string){localStorage.removeItem(wrapperName(recordId));}
async function prfKey(prf:ArrayBuffer){return crypto.subtle.importKey("raw",prf,"AES-GCM",false,["encrypt","decrypt"]);}
export async function enableDeviceUnlock(recordId:string,passphrase:string) {
  const salt=crypto.getRandomValues(new Uint8Array(32));const result=await deviceAuthenticate(salt);
  if(!result.prf)throw new Error("当前浏览器或验证器不支持 PRF，请继续使用保险箱口令");
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const data=await crypto.subtle.encrypt({name:"AES-GCM",iv},await prfKey(result.prf),new TextEncoder().encode(passphrase));
  const wrapper:Wrapper={id:result.id,salt:to64(salt.buffer),iv:to64(iv.buffer),data:to64(data)};
  localStorage.setItem(wrapperName(recordId),JSON.stringify(wrapper));
}
export async function deviceUnlock(recordId:string) {
  const wrapper=JSON.parse(localStorage.getItem(wrapperName(recordId))||"null") as Wrapper|null;
  if(!wrapper)throw new Error("请先用保险箱口令解锁并启用设备快捷解锁");
  const result=await deviceAuthenticate(from64(wrapper.salt),wrapper.id);
  if(!result.prf)throw new Error("此设备不支持 PRF，请使用保险箱口令");
  const text=await crypto.subtle.decrypt({name:"AES-GCM",iv:from64(wrapper.iv)},await prfKey(result.prf),from64(wrapper.data));
  return new TextDecoder().decode(text);
}
