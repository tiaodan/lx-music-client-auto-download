#!/usr/bin/env node
/**
 * Check CSS Module usage in Vue files
 * Reads JSON from stdin, outputs warning if CSS Module is used incorrectly
 *
 * Rule: When using <style module>, classes must be referenced via $style.xxx
 * in the template, not directly as plain class names.
 */

const fs = require('fs');

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const filePath = data.tool_input?.file_path || data.tool_response?.filePath || '';

    // Only check .vue files
    if (!filePath.endsWith('.vue')) {
      process.exit(0);
    }

    // Read file content
    if (!fs.existsSync(filePath)) {
      process.exit(0);
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    // Check if file uses <style module>
    if (!/<style[^>]*module[^>]*>/.test(content)) {
      process.exit(0);
    }

    // Extract template section
    const templateMatch = content.match(/<template[^>]*>([\s\S]*?)<\/template>/i);
    if (!templateMatch) {
      process.exit(0);
    }
    const template = templateMatch[1];

    // Check if template uses $style at all
    const hasStyleReference = /\$style\.|\$style\[/.test(template);

    // If style module is used but no $style reference in template
    if (!hasStyleReference) {
      const output = {
        systemMessage: `⚠️ CSS Module 检查: 文件使用了 <style module> 但模板中没有通过 $style 引用样式。请使用 :class="$style.className" 或 div(:class="$style.className") 来引用样式类。`
      };
      console.log(JSON.stringify(output));
    }
  } catch (e) {
    // Silently ignore errors
    process.exit(0);
  }
});