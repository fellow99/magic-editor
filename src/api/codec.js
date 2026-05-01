/**
 * ROT13(Base64(UTF-8)) 编解码工具
 *
 * 与 magic-api 2.2.2 后端 `org.ssssssss.magicapi.utils.ROT13Utils` 保持字节级一致：
 *  - 编码：JSON 字符串 -> UTF-8 字节 -> Base64 -> 对字母做 ROT13
 *  - 解码：去除首尾引号 -> ROT13 -> Base64 解码 -> UTF-8 字节 -> JSON 字符串
 *
 * 注意：
 *  - 多字节字符（中文、emoji）必须先经 TextEncoder 转 UTF-8，再以 latin1 中转喂给 btoa。
 *    直接 `btoa(jsonString)` 在含非 ASCII 时会抛 InvalidCharacterError。
 *  - 仅在 `EP-RES-004 saveFile` 调用点使用；不挂全局，不进 axios 拦截器。
 */

function rot13(str) {
  let out = ''
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    if (c >= 0x41 && c <= 0x5a) {
      out += String.fromCharCode(((c - 0x41 + 13) % 26) + 0x41)
    } else if (c >= 0x61 && c <= 0x7a) {
      out += String.fromCharCode(((c - 0x61 + 13) % 26) + 0x61)
    } else {
      out += String.fromCharCode(c)
    }
  }
  return out
}

function utf8BytesToLatin1(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return s
}

/**
 * 编码 JSON 字符串为后端可识别的 ROT13(Base64(UTF-8)) 字符串。
 * @param {string} jsonString
 * @returns {string}
 */
export function rot13b64Encode(jsonString) {
  const bytes = new TextEncoder().encode(jsonString)
  const b64 = btoa(utf8BytesToLatin1(bytes))
  return rot13(b64)
}

/**
 * 解码 ROT13(Base64(UTF-8)) 字符串为原始 JSON 字符串。
 * 兼容后端可能在外层附加引号的写法（先剥首尾 `"`）。
 * @param {string} input
 * @returns {string}
 */
export function rot13b64Decode(input) {
  const trimmed = String(input).replace(/^"|"$/g, '')
  const b64 = rot13(trimmed)
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder('utf-8').decode(bytes)
}

export default { rot13b64Encode, rot13b64Decode }
