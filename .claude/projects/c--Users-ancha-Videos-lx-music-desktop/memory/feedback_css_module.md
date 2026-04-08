---
name: CSS Module 使用规范
description: Vue 项目中 CSS Module 的正确使用方式
type: feedback
---

**规则**：使用 `<style module>` 时，必须通过 `$style.类名` 引用样式，不能直接写类名。

**Why**：CSS Module 会将类名编译成哈希值（如 `.formRow_x7d2f`），直接写 `.form-row` 无法匹配。

**How to apply**：
- Pug 模板：`div(:class="$style.formRow")`
- 样式定义：`.formRow { ... }`（建议驼峰命名）
- 非模块样式：`<style>` 不加 module，可以直接用类名

**常见错误**：
```pug
// 错误 - 不会被 CSS Module 处理
.form-row
  label xxx

// 正确
div(:class="$style.formRow")
  label xxx
```

**判断方法**：如果 `<style module>` 里的样式不生效，检查模板中是否用了 `:class="$style.xxx"`。