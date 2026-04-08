#!/bin/bash
# Check CSS Module usage in Vue files
# Reads JSON from stdin, outputs warning if CSS Module is used incorrectly

read -r json_input
file_path=$(echo "$json_input" | jq -r '.tool_input.file_path // .tool_response.filePath // empty')

# Only check .vue files
if [[ "$file_path" != *.vue ]]; then
  exit 0
fi

# Read the file content
if [[ ! -f "$file_path" ]]; then
  exit 0
fi

content=$(cat "$file_path")

# Check if file uses <style module>
if ! echo "$content" | grep -q '<style.*module.*>'; then
  exit 0
fi

# Check if template uses $style.
# Find CSS class definitions in style module
style_classes=$(echo "$content" | grep -oP '(?<=<style[^>]*module[^>]*>)[\s\S]*?(?=</style>)' | grep -oP '^\.[a-zA-Z_][a-zA-Z0-9_]*' | sed 's/^\.//' | sort -u)

if [[ -z "$style_classes" ]]; then
  exit 0
fi

# Check if these classes are referenced with $style in template
issues=""
for class in $style_classes; do
  # Check for direct class usage (not $style.class)
  if echo "$content" | grep -qP "(?<!\$style\.)\b$class\b(?!\s*:)"; then
    # Make sure it's in template section and not already using $style
    if echo "$content" | grep -P "(?<!\$style\.)\b$class\b" | grep -qv "\$style\.$class"; then
      issues="$issues $class"
    fi
  fi
done

if [[ -n "$issues" ]]; then
  echo "{\"systemMessage\": \"⚠️ CSS Module 检查: 以下类名可能未通过 \$style 引用: $issues。在 <style module> 中定义的类必须使用 :class=\\\"\$style.className\\\" 来引用。\"}"
else
  exit 0
fi