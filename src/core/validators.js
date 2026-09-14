// src/core/validators.js

export const NAME_MAX = 8

// 中文、英文字母、数字，以及常见姓名符号 · - _ . 与空格。
//
// 汉字范围用「CJK 扩展 A（U+3400–U+4DBF）+ 基本区全段（U+4E00–U+9FFF）」，
// 而不是 Unicode 1.1 时代的 U+4E00–U+9FA5 —— 后者会拒掉扩展 A 的汉字
// （如 䶮 U+4DAE，真实姓名用字），现场遇到生僻字姓名会直接卡死，
// 而用户屏幕上明明显示的是汉字，只会觉得产品坏了。
const NAME_RE = /^[\u3400-\u4dbf\u4e00-\u9fffA-Za-z0-9·\-_. ]+$/

export function validateName(raw) {
  const value = String(raw ?? '').trim()
  if (value.length === 0) {
    return { ok: false, value, error: '请填写名字' }
  }
  if ([...value].length > NAME_MAX) {
    return { ok: false, value, error: `名字最多 ${NAME_MAX} 个字` }
  }
  if (!NAME_RE.test(value)) {
    return { ok: false, value, error: '名字只能用中文、字母、数字和 · - _ .' }
  }
  return { ok: true, value, error: null }
}

export function validateProfile(profile, cfg) {
  const errors = {}

  const nameResult = validateName(profile?.name)
  if (!nameResult.ok) errors.name = nameResult.error

  const dept = profile?.dept
  if (!dept || !Object.prototype.hasOwnProperty.call(cfg.departments, dept)) {
    errors.dept = '请选择部门'
  }

  if (!cfg.tenures.includes(profile?.tenure)) {
    errors.tenure = '请选择入职年限'
  }

  if (!cfg.zodiacs.includes(profile?.zodiac)) {
    errors.zodiac = '请选择星座'
  }

  return { ok: Object.keys(errors).length === 0, errors }
}
