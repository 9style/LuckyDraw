// src/core/validators.js

export const NAME_MAX = 8
export const DEPT_MAX = 12

// 中文、英文字母、数字，以及常见姓名符号 · - _ . 与空格。
//
// 汉字范围用「CJK 扩展 A（U+3400–U+4DBF）+ 基本区全段（U+4E00–U+9FFF）」，
// 而不是 Unicode 1.1 时代的 U+4E00–U+9FA5 —— 后者会拒掉扩展 A 的汉字
// （如 䶮 U+4DAE，真实姓名用字），现场遇到生僻字姓名会直接卡死，
// 而用户屏幕上明明显示的是汉字，只会觉得产品坏了。
const NAME_RE = /^[\u3400-\u4dbf\u4e00-\u9fffA-Za-z0-9·\-_. ]+$/

// 部门与姓名同源（同取扩展 A + 基本区全段），但**额外放开 `/`**：
// 6 个规范名里有 3 个自带斜杠（「技术 / 研发」「产品 / 设计」「人力 / 行政 / 财务」），
// 直接复用 NAME_RE 会把自己人拒掉 —— 用户照抄我们给的规范名反而过不了校验。
// 长度上限给到 12（名字是 8），「大区销售支持」这类真实部门名更长。
const DEPT_RE = /^[㐀-䶿一-鿿A-Za-z0-9·\-_. /]+$/

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

/**
 * 部门从下拉框改成自由文本后，本函数只校验**形态**（非空、长度、字符集），
 * 不再校验是否属于 6 大类 —— 归到哪一类是 `matchDept` 的事，发生在提交那一刻。
 * 两者刻意分开：本函数不依赖 keywords，配置里增删关键词不会影响校验结果。
 */
export function validateDept(raw) {
  const value = String(raw ?? '').trim()
  if (value.length === 0) {
    return { ok: false, value, error: '请填写部门' }
  }
  if ([...value].length > DEPT_MAX) {
    return { ok: false, value, error: `部门最多 ${DEPT_MAX} 个字` }
  }
  if (!DEPT_RE.test(value)) {
    return { ok: false, value, error: '部门只能用中文、字母、数字和 · - _ . /' }
  }
  return { ok: true, value, error: null }
}

export function validateProfile(profile, cfg) {
  const errors = {}

  const nameResult = validateName(profile?.name)
  if (!nameResult.ok) errors.name = nameResult.error

  const deptResult = validateDept(profile?.dept)
  if (!deptResult.ok) errors.dept = deptResult.error

  if (!cfg.tenures.includes(profile?.tenure)) {
    errors.tenure = '请选择入职年限'
  }

  if (!cfg.zodiacs.includes(profile?.zodiac)) {
    errors.zodiac = '请选择星座'
  }

  return { ok: Object.keys(errors).length === 0, errors }
}
